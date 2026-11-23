// Önizleme: timeline'daki her sahnenin ortasından bir kare PNG/JPG olarak kaydeder.
// Kullanım: node renderer/stills.mjs <timeline.json> <klasör> [--at 0.5]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [tlPath, outDir] = process.argv.slice(2);
const atIdx = process.argv.indexOf('--at'); const at = atIdx > 0 ? parseFloat(process.argv[atIdx + 1]) : 0.6;
const TL = JSON.parse(fs.readFileSync(tlPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2' }[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('[sayfa hatası]', e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[konsol]', m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/renderer/index.html`);
await page.waitForFunction(() => window.__ready === true);
await page.evaluate((tl) => window.initEngine(tl), TL);
for (let i = 0; i < TL.scenes.length; i++) {
  const s = TL.scenes[i]; const t = s.start + (s.end - s.start) * at;
  const t0 = Date.now();
  const url = await page.evaluate((t) => window.renderFrame(t), t);
  const t1 = Date.now();
  await page.evaluate((t) => window.renderFrame(t), t + 1 / 30);
  fs.writeFileSync(path.join(outDir, `scene_${String(i).padStart(2, '0')}_${s.visual.type}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
  console.log(`${i} ${s.visual.type}: ilk kare ${t1 - t0} ms, sonraki ${Date.now() - t1} ms`);
}
await browser.close(); server.close();
