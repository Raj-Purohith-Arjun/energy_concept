import { createHash, timingSafeEqual } from "node:crypto";

export type AuthDecision = "allow" | "challenge" | "misconfigured";

export interface AuthEnv {
  DEMO_USER?: string;
  DEMO_PASS?: string;
  PERF_PUBLIC?: string;
  VERCEL_ENV?: string;
}

export interface Credentials {
  user: string;
  pass: string;
}

// Real Basic headers are well under this; anything longer is rejected unparsed.
const MAX_HEADER_LENGTH = 1024;
const BASIC_HEADER = /^Basic[ \t]+([A-Za-z0-9+/]+={0,2})[ \t]*$/i;

export function parseBasicAuth(header: string | null): Credentials | null {
  if (!header || header.length > MAX_HEADER_LENGTH) return null;
  const match = BASIC_HEADER.exec(header);
  if (!match) return null;
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  // Split on the first colon only: passwords may contain colons, user-ids may not.
  const separator = decoded.indexOf(":");
  if (separator < 0) return null;
  return { user: decoded.slice(0, separator), pass: decoded.slice(separator + 1) };
}

// Hashing first gives equal-length buffers, so timingSafeEqual never throws
// and the comparison time does not depend on where the inputs differ.
function safeEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

// Any deployed Vercel environment is reachable by URL, so it must never
// fall back to public. Only local runs (no VERCEL_ENV, or `vercel dev`) do.
function isDeployed(vercelEnv: string | undefined): boolean {
  return vercelEnv === "production" || vercelEnv === "preview";
}

export function decideAuth(authorization: string | null, env: AuthEnv): AuthDecision {
  // Temporary measurement bypass — redeploy without PERF_PUBLIC immediately after.
  if (env.PERF_PUBLIC === "1") return "allow";

  const { DEMO_USER: user, DEMO_PASS: pass } = env;
  if (!user || !pass) {
    return isDeployed(env.VERCEL_ENV) ? "misconfigured" : "allow";
  }

  const credentials = parseBasicAuth(authorization);
  if (!credentials) return "challenge";

  // Evaluate both so the response time doesn't reveal which field was wrong.
  const userOk = safeEqual(credentials.user, user);
  const passOk = safeEqual(credentials.pass, pass);
  return userOk && passOk ? "allow" : "challenge";
}
