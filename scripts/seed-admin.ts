// Administrator bootstrap is handled through Clerk metadata, never a local profile.
console.error("Use Clerk CLI to set publicMetadata.portalRole=admin on an explicitly approved verified account. See docs/clerk-cutover.md.");
process.exitCode = 1;
