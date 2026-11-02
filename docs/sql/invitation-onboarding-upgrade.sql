-- Review and apply AFTER the prototype phases and Clerk identity cutover.
-- No authentication archive is read, imported, or dropped by this upgrade.
-- Rehearse on a copy and resolve any duplicate references before applying.
BEGIN;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS clerk_invitation_id text;

-- Previous sandbox delivery is not a Clerk email request. Keep the invitation
-- pending/expired as it was; the operator must explicitly resend it via Clerk.
UPDATE invitations
SET delivery_state = 'failed',
    delivery_error = 'This legacy invitation must be resent through Clerk.'
WHERE delivery_state = 'sandbox';

-- These indexes deliberately fail on duplicate historical values. Resolve the
-- ownership with the insurer; do not silently overwrite/reassign policies.
CREATE UNIQUE INDEX IF NOT EXISTS invitation_policy_number_unique
  ON invitations (enrollment_policy_number);
CREATE UNIQUE INDEX IF NOT EXISTS organization_insurer_reference_unique
  ON policies (organization_id, lower(trim(insurer_reference)))
  WHERE source = 'manual' AND insurer_reference IS NOT NULL AND trim(insurer_reference) <> '';
COMMIT;
