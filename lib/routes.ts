export const ROUTES = {
  HOME: "/",
  SIGNIN: "/sign-in",
  SIGNUP: "/sign-up",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",
  VERIFY_EMAIL: "/verify-email",

  // Dashboards
  DASHBOARD: "/dashboard",
  DASHBOARD_USER: "/dashboard/user",
  DASHBOARD_AGENT: "/dashboard/agent",
  DASHBOARD_HEAD_AGENT: "/dashboard/head-agent",
  DASHBOARD_ADMIN: "/dashboard/admin",

  // Core pages
  CLAIMS: "/claims",
  POLICIES: "/policies",
  CUSTOMERS: "/customers",
  AGENTS: "/agents",
  ORGANIZATIONS: "/organizations",
  SETTINGS: "/settings",
  LOGOUT: "/logout",
  CLAIM_FORMS: "/claim-forms",

  //APIs
  API_ROUTES: "/api",
} as const;