// Reserved identities: never resolve demo access from a caller-supplied email/id.
export const DEMO_TEACHER_ID = "d3e00000-0000-4000-8000-000000000001";
export const DEMO_STUDENT_ID = "d3e00000-0000-4000-8000-000000000002";
export const DEMO_TEACHER_PROFILE_ID = "d3e00000-0000-4000-8000-000000000003";
export const DEMO_EMAIL_DOMAIN = "demo.classpulse.invalid";
export const DEMO_READ_ONLY_MESSAGE =
  "This is a read-only demo. Sign in with your own account to make changes.";

export function isDemoUser(id: string | undefined) {
  return id === DEMO_TEACHER_ID || id === DEMO_STUDENT_ID;
}

export function demoEnabled() {
  return process.env.DEMO_MODE !== "false";
}

export function demoBlocksRequest(path: string, method: string) {
  // Auth endpoints must remain available for sign-out and ordinary sign-in.
  if (path === "/api/auth" || path.startsWith("/api/auth/")) return false;
  if (!path.startsWith("/api/")) return false;
  return !["GET", "HEAD", "OPTIONS"].includes(method) || path.startsWith("/api/realtime/");
}
