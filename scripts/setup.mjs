// One-command setup for a clean clone: install dependencies, create .env with a fresh
// secret, apply database migrations, and load the demo data into an empty database.
// Safe to re-run: it never overwrites an existing .env and never re-seeds a database
// that already has users.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const MIN_NODE = [18, 17];
const isWindows = process.platform === "win32";

function fail(message) {
  console.error(`\nSetup failed: ${message}`);
  process.exit(1);
}

function run(command, args) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  // Fixed arguments only; nothing from the environment or user input is interpolated.
  const result = spawnSync(command, args, { stdio: "inherit", shell: isWindows });
  if (result.status !== 0) fail(`"${command} ${args.join(" ")}" exited with code ${result.status}.`);
}

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < MIN_NODE[0] || (major === MIN_NODE[0] && minor < MIN_NODE[1])) {
  fail(`Node.js ${MIN_NODE.join(".")} or later is required (found ${process.versions.node}). Install a newer Node.js and re-run.`);
}
if (!existsSync("package.json") || !existsSync(".env.example")) {
  fail("Run this from the project root (the folder containing package.json and .env.example).");
}

if (!existsSync("node_modules")) run("npm", ["ci"]);
else console.log("\nDependencies already installed, skipping npm ci.");

if (existsSync(".env")) {
  console.log("\n.env already exists, leaving it unchanged.");
} else {
  copyFileSync(".env.example", ".env");
  const secret = randomBytes(32).toString("base64");
  const env = readFileSync(".env", "utf8").replace(/^NEXTAUTH_SECRET=.*$/m, `NEXTAUTH_SECRET="${secret}"`);
  writeFileSync(".env", env);
  chmodSync(".env", 0o600); // the file holds secrets; keep it private to the owner
  console.log("\nCreated .env from .env.example with a newly generated NEXTAUTH_SECRET.");
}

// Enable the repository's pre-commit checks (secret and lint checks). Local config only.
if (existsSync(".git")) {
  const hooks = spawnSync("git", ["config", "core.hooksPath", ".githooks"], { shell: isWindows });
  console.log(hooks.status === 0 ? "\nEnabled the pre-commit hook (.githooks/pre-commit)." : "\nCould not enable the pre-commit hook; run: git config core.hooksPath .githooks");
}

run("npx", ["prisma", "generate"]);
run("npx", ["prisma", "migrate", "deploy"]);

// Seed only an empty database, so re-running setup never touches real data.
if (typeof process.loadEnvFile === "function") process.loadEnvFile(".env");
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
let users;
try {
  users = await prisma.user.count();
} finally {
  await prisma.$disconnect();
}
if (users === 0) {
  run("npm", ["run", "seed"]);
  console.log("\nSeeded demo logins (development only): demo@example.com and client@example.com, password: password123");
} else {
  console.log(`\nDatabase already has ${users} user(s), skipping the demo seed.`);
}

console.log("\nDone. Start the app with: npm run dev   (http://localhost:3000)");
