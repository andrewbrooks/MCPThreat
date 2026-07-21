// Regenerate the README screenshots. Requires the dev server running
// (`npm run dev`) and the demo seeded (`npm run seed`).
//
//   node docs/capture-screenshots.mjs
//
// Logs in as the demo user, visits the key pages, and writes PNGs to
// docs/screenshots/. Dev-only tooling (Playwright); not shipped at runtime.

import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "screenshots");

const prisma = new PrismaClient();
const project = await prisma.project.findFirst({
  where: { name: "Example Payment MCP" },
  select: { id: true },
});
await prisma.$disconnect();
if (!project) throw new Error("Seed the demo first: npm run seed");
const id = project.id;

const shots = [
  { name: "dashboard", path: "/", full: false },
  { name: "overview", path: `/projects/${id}`, full: true },
  { name: "threat-model", path: `/projects/${id}/model`, full: true },
  { name: "architecture", path: `/projects/${id}/architecture`, full: true },
  { name: "dataflow", path: `/projects/${id}/dataflow`, full: true },
  { name: "findings", path: `/projects/${id}/findings`, full: true },
  { name: "report", path: `/projects/${id}/report`, full: true },
];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "light",
  reducedMotion: "reduce",
});
const page = await context.newPage();

// Sign in.
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", "demo@example.com");
await page.fill("#password", "password123");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 15000 });

for (const s of shots) {
  await page.goto(`${BASE}${s.path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600); // let charts/SVG settle
  await page.screenshot({ path: join(OUT, `${s.name}.png`), fullPage: s.full });
  console.log("captured", s.name);
}

await browser.close();
