// Render card.html to a 1200x630 PNG, or with --many a JSON list of [html, png]
// pairs in one browser. PLAYWRIGHT_CORE and CHROME may point at an installed
// playwright-core and Chromium binary.
import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const args = process.argv.slice(2);
const jobs = args[0] === '--many' ? JSON.parse(readFileSync(args[1], 'utf8')) : [args];
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
for (const [src, dest] of jobs) {
  await p.goto('file://' + src);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: dest });
}
await b.close();
console.log('wrote', jobs.length === 1 ? jobs[0][1] : jobs.length + ' images');
