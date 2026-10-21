-- MANUAL PHASE 2 HANDOFF ONLY. Not executed by the coding agent.
-- Phase 1 must already be committed. Run this entire file as one transaction.
-- Clear any failed transaction in the same SQL-editor session before running.
-- Extracted from docs/prototype-schema-upgrade.sql; that file is the source.
-- Run BEFORE docs/sql/clerk-identity-cutover.sql, while the legacy user table exists.

-- PHASE 2: after phase 1 has committed. Includes the invitation/auth changes.
BEGIN;

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



ALTER TABLE policies ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'active';
ALTER TABLE policies ADD COLUMN IF NOT EXISTS coverage_start varchar(10);
ALTER TABLE policies ADD COLUMN IF NOT EXISTS coverage_end varchar(10);
ALTER TABLE policies ADD COLUMN IF NOT EXISTS insured_asset text;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS coverage_summary text;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS insurer_reference varchar(100);
ALTER TABLE policies ADD COLUMN IF NOT EXISTS source varchar(20) NOT NULL DEFAULT 'demo';
ALTER TABLE policies ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

ALTER TABLE claims ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE claims ADD COLUMN IF NOT EXISTS form_data jsonb;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS original_submission jsonb;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS policy_snapshot jsonb;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS form_version varchar(20) NOT NULL DEFAULT 'fnol-v1';
ALTER TABLE claims ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS incident_date varchar(10);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS contact_phone varchar(40);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS assessment_summary text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS estimated_loss_amount numeric(14,2);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS assessed_by uuid REFERENCES "user"(id);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS assessed_at timestamp;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES "user"(id);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES "user"(id);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS submitted_at timestamp;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS outcome_reason text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS outcome_source varchar(20);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS withdrawal_requested_at timestamp;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS withdrawal_reason text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS carrier_reference varchar(100);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS carrier_handoff_state varchar(20) NOT NULL DEFAULT 'not_sent';
ALTER TABLE claims ADD COLUMN IF NOT EXISTS settlement_amount numeric(14,2);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS settlement_reference varchar(100);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS settlement_recorded_at timestamp;

ALTER TABLE motor_claim_details ALTER COLUMN is_vehicle_drivable TYPE varchar(10);
ALTER TABLE burglary_claim_details ALTER COLUMN was_anyone_home TYPE varchar(10);
ALTER TABLE burglary_claim_details ALTER COLUMN evidence_of_violence TYPE varchar(10);
ALTER TABLE burglary_claim_details ALTER COLUMN alarm_fitted TYPE varchar(10);
ALTER TABLE burglary_claim_details ALTER COLUMN alarm_active_at_time TYPE varchar(10);

ALTER TABLE claim_notes ADD COLUMN IF NOT EXISTS visibility varchar(20) NOT NULL DEFAULT 'internal';
ALTER TABLE claim_progress_steps ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;
ALTER TABLE claim_attachments ADD COLUMN IF NOT EXISTS category varchar(50) NOT NULL DEFAULT 'other';
ALTER TABLE claim_attachments ADD COLUMN IF NOT EXISTS loss_item_id varchar(100);
ALTER TABLE claim_attachments ADD COLUMN IF NOT EXISTS client_upload_id uuid;
ALTER TABLE claim_attachments ADD COLUMN IF NOT EXISTS content_sha256 varchar(64);
ALTER TABLE claim_attachments ADD COLUMN IF NOT EXISTS upload_state varchar(20) NOT NULL DEFAULT 'ready';
ALTER TABLE claim_attachments ADD COLUMN IF NOT EXISTS upload_error text;
ALTER TABLE claim_attachments ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
ALTER TABLE claim_attachments ADD COLUMN IF NOT EXISTS scan_state varchar(20) NOT NULL DEFAULT 'pending';
ALTER TABLE claim_attachments ADD COLUMN IF NOT EXISTS review_status varchar(20) NOT NULL DEFAULT 'pending';
ALTER TABLE claim_attachments ADD COLUMN IF NOT EXISTS review_note text;
ALTER TABLE claim_attachments ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES "user"(id);
ALTER TABLE claim_attachments ADD COLUMN IF NOT EXISTS reviewed_at timestamp;
CREATE UNIQUE INDEX IF NOT EXISTS claim_upload_unique ON claim_attachments(claim_id, client_upload_id);
CREATE INDEX IF NOT EXISTS claims_org_status_idx ON claims(organization_id, status);
CREATE INDEX IF NOT EXISTS claims_assigned_status_idx ON claims(assigned_agent_id, status);
CREATE INDEX IF NOT EXISTS claims_policy_incident_idx ON claims(policy_id, incident_date);

CREATE TABLE IF NOT EXISTS claim_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims(id), actor_id uuid REFERENCES "user"(id),
  type varchar(50) NOT NULL, visibility varchar(20) NOT NULL DEFAULT 'public',
  content text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS claim_events_claim_time_idx ON claim_events(claim_id, created_at);
CREATE TABLE IF NOT EXISTS evidence_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), claim_id uuid NOT NULL REFERENCES claims(id),
  requested_by uuid NOT NULL REFERENCES "user"(id), title varchar(200) NOT NULL,
  category varchar(50) NOT NULL, message text NOT NULL, due_at timestamp,
  status varchar(20) NOT NULL DEFAULT 'open', response text, response_by uuid REFERENCES "user"(id), response_at timestamp,
  resolved_by uuid REFERENCES "user"(id), resolved_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evidence_requests_claim_status_idx ON evidence_requests(claim_id, status);
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid REFERENCES organizations(id),
  actor_id uuid REFERENCES "user"(id), target_user_id uuid REFERENCES "user"(id),
  action varchar(100) NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamp NOT NULL DEFAULT now()
);

-- Preserve pre-upgrade report/history data. No invented original submission,
-- payment evidence, actor, coverage confirmation or insurer handoff is backfilled.
-- Existing notes default to private. Existing documents need manual inspection.
-- Legacy progress tasks remain editable supporting tasks, not system milestones.

CREATE OR REPLACE FUNCTION portal_append_only_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Portal events are append-only; record a correction event';
END;
$$;
DROP TRIGGER IF EXISTS claim_events_append_only ON claim_events;
CREATE TRIGGER claim_events_append_only BEFORE UPDATE OR DELETE ON claim_events
FOR EACH ROW EXECUTE FUNCTION portal_append_only_event();
DROP TRIGGER IF EXISTS audit_events_append_only ON audit_events;
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION portal_append_only_event();

-- Once a snapshot exists, corrections must be recorded as amendments/events.
CREATE OR REPLACE FUNCTION portal_preserve_submission() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.original_submission IS NOT NULL AND NEW.original_submission IS DISTINCT FROM OLD.original_submission THEN
    RAISE EXCEPTION 'Original submission is preserved; record an amendment';
  END IF;
  IF OLD.policy_snapshot IS NOT NULL AND NEW.policy_snapshot IS DISTINCT FROM OLD.policy_snapshot THEN
    RAISE EXCEPTION 'Submitted policy snapshot is preserved';
  END IF;
  IF OLD.submitted_at IS NOT NULL AND (NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR NEW.form_data IS DISTINCT FROM OLD.form_data OR NEW.form_version IS DISTINCT FROM OLD.form_version OR NEW.policy_id IS DISTINCT FROM OLD.policy_id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id) THEN
    RAISE EXCEPTION 'Submitted report identity and answers are preserved';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS claims_preserve_submission ON claims;
CREATE TRIGGER claims_preserve_submission BEFORE UPDATE ON claims
FOR EACH ROW EXECUTE FUNCTION portal_preserve_submission();

COMMIT;
