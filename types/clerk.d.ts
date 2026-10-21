export {};

declare global {
  interface CustomJwtSessionClaims {
    portal_role?: "admin" | "head_agent" | "agent" | "user";
  }
}
