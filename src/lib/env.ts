// Startup checks for configuration that must be right in production. Kept pure
// (environment in, list of problems out) so it can be tested without a running app.

export const PLACEHOLDER_SECRETS = ["change-me-in-production"];
const MIN_SECRET_LENGTH = 32;

type Env = Record<string, string | undefined>;

/** What is wrong with the production configuration, each with how to fix it. */
export function productionEnvProblems(env: Env): string[] {
  const problems: string[] = [];
  const secret = env.NEXTAUTH_SECRET?.trim() ?? "";
  if (!secret) {
    problems.push("NEXTAUTH_SECRET is not set. Generate one with: openssl rand -base64 32");
  } else if (PLACEHOLDER_SECRETS.includes(secret)) {
    problems.push(
      "NEXTAUTH_SECRET is still the placeholder from .env.example. Generate a real one with: openssl rand -base64 32",
    );
  } else if (secret.length < MIN_SECRET_LENGTH) {
    problems.push(
      `NEXTAUTH_SECRET is too short (${secret.length} characters; need at least ${MIN_SECRET_LENGTH}). Generate one with: openssl rand -base64 32`,
    );
  }
  // Hosted platforms such as Vercel provide the URL themselves.
  if (!env.NEXTAUTH_URL?.trim() && !env.VERCEL_URL) {
    problems.push(
      "NEXTAUTH_URL is not set. Set it to the public URL of this app, for example https://mcpthreat.example.com",
    );
  }
  if (!env.DATABASE_URL?.trim()) {
    problems.push("DATABASE_URL is not set. Point it at your database.");
  }
  return problems;
}

/**
 * Throw, with every problem listed, if the production configuration is unsafe. Does
 * nothing outside production, and nothing while `next build` is collecting pages
 * (secrets are only needed at runtime).
 */
export function assertProductionEnv(env: Env = process.env): void {
  if (env.NODE_ENV !== "production") return;
  if (env.NEXT_PHASE === "phase-production-build") return;
  const problems = productionEnvProblems(env);
  if (problems.length > 0) {
    throw new Error(
      `Unsafe production configuration:\n${problems.map((p) => `  - ${p}`).join("\n")}`,
    );
  }
}
