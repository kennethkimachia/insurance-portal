-- REFERENCE HANDOFF ONLY. Codex has not run this SQL.
-- Apply as part of the complete prototype upgrade after reviewing a backup.
-- Included in prototype-schema-upgrade.sql. Do not run this partial reference separately.
-- Existing user/policy tables and the original invitation enum are prerequisites.

-- Pre-hash invitations cannot be reused after this upgrade. Remove old secrets
-- and expire pending links once, before introducing the purpose column.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invitations' AND column_name = 'purpose'
  ) THEN
    UPDATE invitations
    SET token = 'retired-' || id::text,
        status = CASE WHEN status = 'pending' THEN 'expired'::invitation_status ELSE status END;
  END IF;
END $$;

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS phone varchar(30),
  ADD COLUMN IF NOT EXISTS suspended_at timestamp,
  ADD COLUMN IF NOT EXISTS suspension_reason text;

ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS purpose varchar(20) NOT NULL DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS revoked_at timestamp,
  ADD COLUMN IF NOT EXISTS accepted_at timestamp,
  ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES "user"(id),
  ADD COLUMN IF NOT EXISTS enrollment_name text,
  ADD COLUMN IF NOT EXISTS enrollment_phone varchar(30),
  ADD COLUMN IF NOT EXISTS enrollment_policy_type varchar(20),
  ADD COLUMN IF NOT EXISTS enrollment_policy_number varchar(50),
  ADD COLUMN IF NOT EXISTS policy_profile jsonb,
  ADD COLUMN IF NOT EXISTS delivery_state varchar(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_error text,
  ADD COLUMN IF NOT EXISTS last_sent_at timestamp;

CREATE INDEX IF NOT EXISTS invitations_organization_purpose_created_idx
  ON invitations (organization_id, purpose, created_at DESC);

-- audit_events and expanded policies metadata are provided by the consolidated
-- prototype upgrade. Both are required for invitation acceptance and staff
-- access changes; this partial file is not an independently deployable upgrade.
-- All invitation emails are normalized by the application. Existing invitations
-- are retired above, and pending rows are replaced/resendable from the UI.
