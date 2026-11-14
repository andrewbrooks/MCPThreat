// Prints how many users the database has. scripts/setup.mjs runs it (through tsx) to decide
// whether the demo data should be seeded, because plain Node cannot import the generated
// Prisma client, which is TypeScript.
import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    console.log(await prisma.user.count());
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
