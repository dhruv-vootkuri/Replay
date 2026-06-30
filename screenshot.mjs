import { chromium } from "playwright";
import { existsSync, mkdirSync } from "fs";

const OUT = "/private/tmp/claude-501/-Users-kevingeng07-Desktop-ReplayAI/051a0d58-3dec-4728-aeed-5b2b7feba667/scratchpad/screenshots";
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile",  width: 390,  height: 844 },
];

// scroll positions in vh units → absolute pixels
const SHOTS = [
  { name: "1-landing",          pct: 0.00 },
  { name: "2-problem",          pct: 0.145 },  // ~101/700 — Problem fully in
  { name: "3-features-tab1",    pct: 0.295 },  // ~206/700 — Tab 1 (Insights)
  { name: "3-features-tab2",    pct: 0.44 },   // ~308/700 — Tab 2 (Pressure Tests)
  { name: "3-features-midtransition", pct: 0.37 }, // mid-transition: 2 tabs visible
  { name: "4-waitlist",         pct: 0.875 },  // ~612/700 — Waitlist fully in
];

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  // allow resolve animation to play
  await page.waitForTimeout(3200);

  const totalScroll = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);

  for (const shot of SHOTS) {
    const scrollY = Math.round(shot.pct * totalScroll);
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${vp.name}-${shot.name}.png`, fullPage: false });
    console.log(`captured ${vp.name}-${shot.name} at scrollY=${scrollY}`);
  }

  await page.close();
}

await browser.close();
console.log("Done.");
