// Render card.html to a 1200x630 PNG. PLAYWRIGHT_CORE and CHROME may point at
// an installed playwright-core and Chromium binary.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const [src, dest] = process.argv.slice(2);
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto('file://' + src);
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: dest });
await b.close();
console.log('wrote', dest);
