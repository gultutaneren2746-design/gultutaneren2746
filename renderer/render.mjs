// Kullanım: node renderer/render.mjs <timeline.json> <cikti.mp4> [--workers N] [--preview saniye]
// three.js sahnelerini headless Chromium'da (SwiftShader WebGL) kare kare çizer, ffmpeg'e akıtır.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(require.resolve('playwright', { paths: [process.env.NODE_PATH || '', '/usr/lib/node_modules', '/opt/node22/lib/node_modules'] })); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const [tlPath, outPath] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!tlPath || !outPath) { console.error('kullanım: render.mjs timeline.json out.mp4'); process.exit(1); }
const TL = JSON.parse(fs.readFileSync(tlPath, 'utf8'));
const workers = Math.max(1, parseInt(opt('--workers', '2'), 10));
const previewSec = opt('--preview', null);
const fromSec = parseFloat(opt('--from', '0'));
const total = previewSec ? Math.min(TL.duration, fromSec + parseFloat(previewSec)) : TL.duration;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const fps = TL.fps;
const f0 = Math.round(fromSec * fps), f1 = Math.round(total * fps);
const nFrames = f1 - f0;
const per = Math.ceil(nFrames / workers);
const tmpDir = path.join(path.dirname(path.resolve(outPath)), '.segments');
fs.mkdirSync(tmpDir, { recursive: true });

const t0 = Date.now();
let done = 0;
function progress() {
  done++;
  if (done % 30 === 0 || done === nFrames) {
    const el = (Date.now() - t0) / 1000, eta = el / done * (nFrames - done);
    process.stdout.write(`  kare ${done}/${nFrames}  ${(done / el).toFixed(1)} kare/sn  kalan ~${Math.round(eta)} sn\n`);
  }
}

async function worker(w) {
  const a = f0 + w * per, b = Math.min(f1, a + per);
  if (a >= b) return null;
  const seg = path.join(tmpDir, `seg_${w}.mp4`);
  const browser = await playwright.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
  page.on('pageerror', (e) => console.error('[sayfa hatası]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('[konsol]', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/renderer/index.html`);
  await page.waitForFunction(() => window.__ready === true && typeof window.initEngine === 'function', null, { timeout: 60000 });
  await page.evaluate((tl) => window.initEngine(tl), TL);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', String(TL.crf ?? 18), '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart', seg],
  { stdio: ['pipe', 'inherit', 'inherit'] });
  const ffDone = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  for (let f = a; f < b; f++) {
    const url = await page.evaluate((t) => window.renderFrame(t), f / fps);
    const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    progress();
  }
  ff.stdin.end(); await ffDone; await browser.close();
  return seg;
}

console.log(`render: ${nFrames} kare, ${workers} işçi, ${TL.width}x${TL.height}@${fps}`);
const segs = (await Promise.all(Array.from({ length: workers }, (_, w) => worker(w)))).filter(Boolean);
server.close();
const list = path.join(tmpDir, 'list.txt');
fs.writeFileSync(list, segs.map((s) => `file '${s}'`).join('\n'));
await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', outPath], { stdio: 'inherit' })
  .on('close', (c) => (c === 0 ? res() : rej(new Error('concat ' + c)))));
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log(`video hazır: ${outPath} (${((Date.now() - t0) / 1000).toFixed(0)} sn)`);
