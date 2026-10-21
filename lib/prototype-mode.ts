export function isPrototypePreviewEnabled(env: {
  NODE_ENV?: string;
  PORTAL_DEMO_ENABLED?: string;
}) {
  return env.NODE_ENV === "development" && env.PORTAL_DEMO_ENABLED === "true";
}
