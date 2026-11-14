// Regenerate the README screenshots. Requires the dev server running
// (`npm run dev`) and the demo seeded (`npm run seed`).
//
//   node docs/capture-screenshots.mjs
//
// Logs in as the demo user, visits the key pages, and writes PNGs to
// docs/screenshots/. Dev-only tooling (Playwright); not shipped at runtime.

import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "screenshots");

const shotsFor = (id) => [
  { name: "dashboard", path: "/", full: false },
  { name: "threat-model", path: `/projects/${id}/model`, full: true },
  { name: "architecture", path: `/projects/${id}/architecture`, full: true },
  { name: "dataflow", path: `/projects/${id}/dataflow`, full: true },
  { name: "findings", path: `/projects/${id}/findings`, full: true },
  { name: "review", path: `/projects/${id}/review`, full: true },
  // The report is a 17-page document; show its cover and executive summary, not all of it.
  { name: "report", path: `/projects/${id}/report`, full: false, height: 2100 },
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

// Find the seeded demo project through the app itself, so this needs no database access.
const listed = await page.request.get(`${BASE}/api/projects`);
const body = await listed.json();
const project = (body.projects ?? body).find((p) => p.name === "Example Payment MCP");
if (!project) throw new Error("Seed the demo first: npm run seed");

for (const s of shotsFor(project.id)) {
  if (s.height) await page.setViewportSize({ width: 1440, height: s.height });
  await page.goto(`${BASE}${s.path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600); // let charts/SVG settle
  await page.screenshot({ path: join(OUT, `${s.name}.png`), fullPage: s.full });
  if (s.height) await page.setViewportSize({ width: 1440, height: 900 });
  console.log("captured", s.name);
}

await browser.close();
