// Browser checks over every page of the built site, run by CI.
//
// For each page, in the light and the dark theme, at 390px and 1280px wide:
//   - axe-core finds no serious or critical violation;
//   - the page is no wider than the screen (a phone must never scroll sideways);
//   - no script throws and no file the page asks for fails to load.
// Three pages are also checked in Urdu (right to left) and Tamil (the longest labels).
//
// The site loads nothing from another origin, so a failed request is a real fault,
// never the sandbox. The script serves the repository itself on a free port.
//
//   npm ci
//   node scripts/audit.mjs                 # every page
//   node scripts/audit.mjs /crimes/rape/   # one page
//   CHROME=/path/to/chrome node scripts/audit.mjs
import { createServer } from 'node:http';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const SKIP = new Set(['node_modules', 'scripts', 'site', 'i18n', '.git', '.github', 'data', 'downloads', 'fonts', 'css', 'js', 'assets', 'context']);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.csv': 'text/csv', '.txt': 'text/plain' };

function pages() {
  const out = ['/', '/404.html'];
  (function walk(dir, url) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (!statSync(p).isDirectory() || name.startsWith('.')) continue;
      if (existsSync(join(p, 'index.html'))) out.push(url + name + '/');
      if (!(url === '/' && SKIP.has(name))) walk(p, url + name + '/');
    }
  })(ROOT, '/');
  return out;
}

const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const only = process.argv.slice(2);
const list = only.length ? only : pages();
const extra = only.length ? [] : ['/', '/crimes/rape/', '/courts/'].flatMap(u => ['ur', 'ta'].map(l => [u, l]));
const views = [];
for (const theme of ['light', 'dark']) for (const width of [390, 1280]) {
  for (const u of list) views.push({ u, theme, width, lang: 'en' });
  for (const [u, lang] of extra) views.push({ u, theme, width, lang });
}

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const faults = [];
async function run(v) {
  const ctx = await browser.newContext({ viewport: { width: v.width, height: 900 }, colorScheme: v.theme });
  await ctx.addInitScript(([t, l]) => { try { localStorage.setItem('wor-theme', t); localStorage.setItem('wor-lang', l); } catch (e) {} }, [v.theme, v.lang]);
  const page = await ctx.newPage();
  const where = `${v.u}${v.lang === 'en' ? '' : '?lang=' + v.lang} ${v.theme} ${v.width}`;
  page.on('pageerror', e => faults.push(`${where}: script error: ${e.message}`));
  page.on('requestfailed', r => faults.push(`${where}: failed to load ${r.url()}`));
  page.on('response', r => { if (r.status() >= 400 && !(v.u === '/404.html' && r.url().endsWith('/404.html'))) faults.push(`${where}: ${r.status()} for ${r.url()}`); });
  await page.goto(BASE + v.u + (v.lang === 'en' ? '' : '?lang=' + v.lang), { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (over > 1) faults.push(`${where}: the page is ${over}px wider than the screen`);
  await page.addScriptTag({ content: AXE });
  const bad = await page.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations
    .filter(x => x.impact === 'serious' || x.impact === 'critical')
    .map(x => `${x.id} (${x.nodes.length}): ${x.nodes.slice(0, 2).map(n => n.target.join(' ')).join(', ')}`));
  for (const b of bad) faults.push(`${where}: ${b}`);
  await ctx.close();
}
const queue = views.slice();
await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) await run(queue.shift()); }));
await browser.close();
server.close();

if (faults.length) {
  console.log(faults.join('\n'));
  console.log(`FAIL: ${faults.length} problems across ${views.length} page views`);
  process.exit(1);
}
console.log(`PASS: ${views.length} page views (${list.length} pages, two themes, 390 and 1280 wide), no serious or critical axe finding, nothing wider than the screen, no failed request`);
