import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Prisma 7 connects through a driver adapter. This is the SQLite one used in dev; for
// Postgres, install @prisma/adapter-pg and construct PrismaPg({ connectionString }) here.
// A relative sqlite path resolves against the working directory, hence "./prisma/dev.db".
export function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Point it at your database (see .env.example).");
  }
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

// Reuse a single PrismaClient across hot reloads in development to avoid
// exhausting the connection pool.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
