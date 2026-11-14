import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer reads .env or the datasource url from schema.prisma, and the seed
// command no longer lives in package.json. The CLI (migrate, db seed) gets all three here.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
