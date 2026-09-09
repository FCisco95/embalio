// Sign-up allow-list for the public /login page.
//
// The app is single-tenant and deployed on a public URL with Vercel Deployment
// Protection off. An open `signUp` form there lets any stranger create an
// account and an empty tenant. So sign-up is CLOSED unless the operator lists
// the permitted emails in AUTH_SIGNUP_ALLOWLIST (comma-separated, case-insensitive).
// Unset or empty → nobody can sign up (fail closed). Sign-in is unaffected.

export function parseSignupAllowlist(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

export function isSignupAllowed(email: string, raw: string | undefined | null): boolean {
  const list = parseSignupAllowlist(raw);
  if (list.length === 0) return false;
  return list.includes(email.trim().toLowerCase());
}

export const SIGNUP_CLOSED_MESSAGE = "Sign-up is closed for this deployment.";
