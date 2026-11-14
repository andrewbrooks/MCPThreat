// The one thing integration tests fake: who is signed in. Everything else (authorization,
// routes, database, audit) is real.
export interface TestSession {
  userId: string | null;
  email: string | null;
}

export const session: TestSession = { userId: null, email: null };

export function signInAs(user: { id: string; email: string } | null): void {
  session.userId = user?.id ?? null;
  session.email = user?.email ?? null;
}
