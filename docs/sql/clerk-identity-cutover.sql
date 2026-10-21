-- REVIEW ONLY. This file has NOT been executed. Run during a maintenance window
-- after a backup, schema review, and a rehearsal on a database copy.
-- FIRST complete docs/prototype-schema-upgrade.sql: phase 1 in its own committed
-- transaction, then the complete phase 2 transaction. The original portal schema
-- alone is not sufficient. This cutover must run last, while "user" still exists.
BEGIN;
SET LOCAL search_path = public;

-- Diagnose an omitted prerequisite before acquiring locks or copying any data.
DO $$ DECLARE missing_prerequisites text; BEGIN
  IF to_regclass('public.portal_actors') IS NOT NULL
     OR to_regclass('public.legacy_auth_users') IS NOT NULL THEN
    RAISE EXCEPTION 'Clerk cutover has already started or completed; review the schema instead of rerunning it';
  END IF;
  SELECT string_agg(required.table_name || '.' || required.column_name, ', '
                   ORDER BY required.table_name, required.column_name)
    INTO missing_prerequisites
    FROM (VALUES
      ('user', 'phone'), ('user', 'suspended_at'), ('user', 'suspension_reason'),
      ('invitations', 'purpose'), ('invitations', 'accepted_by'), ('invitations', 'policy_profile'),
      ('policies', 'source'), ('policies', 'version'),
      ('claims', 'original_submission'), ('claims', 'policy_snapshot'), ('claims', 'created_by'),
      ('claim_attachments', 'client_upload_id'), ('claim_notes', 'visibility'),
      ('claim_events', 'id'), ('evidence_requests', 'id'), ('audit_events', 'id')
    ) AS required(table_name, column_name)
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns present
      WHERE present.table_schema = 'public'
        AND present.table_name = required.table_name
        AND present.column_name = required.column_name
    );
  IF missing_prerequisites IS NOT NULL THEN
    RAISE EXCEPTION 'Prototype schema upgrade is required before the Clerk cutover. Missing: %', missing_prerequisites
      USING HINT = 'Apply docs/prototype-schema-upgrade.sql phase 1, commit it, then apply its complete phase 2 transaction. Run the Clerk cutover last.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (VALUES ('draft'), ('awaiting_information'), ('withdrawn')) required(label)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = 'claim_status' AND e.enumlabel = required.label
    )
  ) THEN
    RAISE EXCEPTION 'Complete and commit prototype-schema-upgrade.sql phase 1 before the Clerk cutover';
  END IF;
END $$;

LOCK TABLE public."user", public.account IN ACCESS EXCLUSIVE MODE;

DO $$ BEGIN
  IF EXISTS (SELECT user_id FROM account WHERE provider_id = 'clerk'
             GROUP BY user_id HAVING count(DISTINCT account_id) > 1)
     OR EXISTS (SELECT account_id FROM account WHERE provider_id = 'clerk'
                GROUP BY account_id HAVING count(DISTINCT user_id) > 1)
     OR EXISTS (SELECT 1 FROM account WHERE provider_id = 'clerk'
                AND (account_id NOT LIKE 'user_%' OR account_id = '')) THEN
    RAISE EXCEPTION 'Ambiguous Clerk mappings: review before cutover';
  END IF;
  IF EXISTS (SELECT 1 FROM policies p JOIN "user" u ON u.id = p.user_id
             WHERE u.role <> 'user' OR u.organization_id IS NULL
                OR u.organization_id <> p.organization_id) THEN
    RAISE EXCEPTION 'Policyholder role or organization conflict: review before cutover';
  END IF;
END $$;

CREATE TABLE portal_actors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text UNIQUE,
  enrolled_at timestamp,
  suspended_at timestamp,
  suspension_reason text,
  sessions_valid_after timestamp,
  pending_role_operation_id uuid,
  retired_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO portal_actors (id, clerk_user_id, enrolled_at, suspended_at,
  suspension_reason, sessions_valid_after, created_at, updated_at)
SELECT u.id, links.clerk_user_id, u.created_at, u.suspended_at,
  u.suspension_reason, links.valid_after, u.created_at, u.updated_at
FROM "user" u LEFT JOIN (
  SELECT user_id, min(account_id) AS clerk_user_id,
    max(access_token_expires_at) AS valid_after
  FROM account WHERE provider_id = 'clerk' GROUP BY user_id
) links ON links.user_id = u.id;

CREATE TABLE policyholder_enrollments (
  actor_id uuid PRIMARY KEY REFERENCES portal_actors(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  phone varchar(30),
  created_at timestamp NOT NULL DEFAULT now()
);
INSERT INTO policyholder_enrollments (actor_id, organization_id, phone, created_at)
SELECT id, organization_id, phone, created_at FROM "user"
WHERE role = 'user' AND organization_id IS NOT NULL;

CREATE TABLE clerk_role_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES portal_actors(id),
  clerk_user_id text NOT NULL,
  invitation_id uuid REFERENCES invitations(id),
  requested_by uuid NOT NULL REFERENCES portal_actors(id),
  desired_role user_role NOT NULL,
  previous_role user_role,
  idempotency_key text NOT NULL UNIQUE,
  status varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','applied','cancelled','blocked')),
  lease_token uuid,
  lease_expires_at timestamp,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamp NOT NULL DEFAULT now(),
  completed_at timestamp
);
CREATE UNIQUE INDEX clerk_role_operations_active_actor_uq
ON clerk_role_operations(actor_id) WHERE status IN ('pending','processing','blocked');

-- Retarget business FKs without changing UUID values, actions, or deferrability.
-- Keep credential/session FKs on the legacy table for the archive.
DO $$ DECLARE fk record; replacement text; BEGIN
  FOR fk IN SELECT c.conrelid::regclass AS child, c.conname,
                    pg_get_constraintdef(c.oid) AS definition
            FROM pg_constraint c
            WHERE c.contype = 'f' AND c.confrelid = 'public."user"'::regclass
              AND c.conrelid NOT IN ('public.account'::regclass, 'public.session'::regclass)
  LOOP
    replacement := regexp_replace(fk.definition,
      'REFERENCES (public\.)?"user"\(', 'REFERENCES public.portal_actors(');
    IF replacement = fk.definition THEN
      RAISE EXCEPTION 'Review unsupported FK definition: %', fk.definition;
    END IF;
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.child, fk.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', fk.child, fk.conname, replacement);
  END LOOP;
END $$;

-- Retain the rollback archive. The new application never queries these tables.
ALTER TABLE public."user" RENAME TO legacy_auth_users;
ALTER TABLE public.account RENAME TO legacy_auth_accounts;
ALTER TABLE public.session RENAME TO legacy_auth_sessions;
ALTER TABLE public.verification RENAME TO legacy_auth_verifications;
COMMIT;

-- Separate read-only verification after commit:
-- SELECT count(*) FROM portal_actors;
-- SELECT count(*) FROM legacy_auth_users; -- must match before new enrollment
-- SELECT id FROM portal_actors WHERE clerk_user_id IS NULL; -- review mapping
-- SELECT count(*) FROM policies p LEFT JOIN portal_actors a ON a.id=p.user_id WHERE a.id IS NULL;
-- SELECT conrelid::regclass, conname FROM pg_constraint
-- WHERE contype='f' AND confrelid='public.legacy_auth_users'::regclass;
-- The last query should return only legacy_auth_accounts / legacy_auth_sessions.
