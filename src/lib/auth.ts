import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import { z } from "zod";
import { assertProductionEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";

// Refuse to run in production with a missing, short or placeholder secret.
assertProductionEnv();

// Non-strict: NextAuth includes extra fields (csrfToken, json) in the credentials
// object, so this must not reject unknown keys.
const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1),
});

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const parsed = credentialsSchema.safeParse(credentials);
      if (!parsed.success) return null;

      const user = await prisma.user.findUnique({
        where: { email: parsed.data.email.toLowerCase() },
      });
      if (!user?.passwordHash) return null;

      const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!valid) return null;

      return { id: user.id, name: user.name, email: user.email, image: user.image };
    },
  }),
];

// GitHub provider is only registered when credentials are present, so the app
// still boots without them.
if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  providers.push(
    GitHubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
  );
}

// The adapter types its argument against "@prisma/client", but the client is generated
// into src/generated. It only calls the model delegates (user, account, ...), which the
// generated client provides; tests/integration/auth-adapter.test.ts exercises that.
type AdapterClient = Parameters<typeof PrismaAdapter>[0];

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma as unknown as AdapterClient),
  // Credentials provider requires JWT session strategy in NextAuth v4.
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

/** The signed-in session on the server, or null when nobody is signed in. */
export function auth() {
  return getServerSession(authOptions);
}

/** Returns the current user's id or null. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** Returns the current actor for audit logging: id plus a display label. */
export async function currentActor(): Promise<{ id: string | null; label: string }> {
  const session = await auth();
  return {
    id: session?.user?.id ?? null,
    label: session?.user?.email ?? session?.user?.name ?? "unknown",
  };
}
