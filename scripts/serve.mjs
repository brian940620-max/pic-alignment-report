import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(root, 'dist');
const watching = process.argv.includes('--watch');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
let version = Date.now(), running = false, pending = false, timer;
function build() {
  if (running) { pending = true; return Promise.resolve(); }
  running = true;
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, ['build.mjs'], { cwd: root, stdio: 'inherit' });
    child.on('error', fail);
    child.on('exit', (code) => {
      running = false;
      if (code === 0) version = Date.now();
      else if (!server.listening) { fail(new Error(`Build exited ${code}`)); return; }
      if (pending) { pending = false; build().catch(console.error); }
      done();
    });
  });
}
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8' };
const server = createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (watching && name === '/__dev_version') { res.writeHead(200, { 'Cache-Control': 'no-store' }); res.end(String(version)); return; }
    const path = resolve(dist, '.' + (name.endsWith('/') ? name + 'index.html' : name));
    if (!path.startsWith(dist + sep)) { res.writeHead(403); res.end(); return; }
    const info = await stat(path);
    if (!info.isFile()) throw new Error('Not a file');
    const headers = { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': watching ? 'no-store' : 'no-cache' };
    if (!watching) {
      headers.ETag = `W/"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`;
      if ((req.headers['if-none-match'] || '').split(',').map(v => v.trim()).some(v => v === '*' || v === headers.ETag || `W/${v}` === headers.ETag)) {
        res.writeHead(304, headers); res.end(); return;
      }
      headers['Content-Length'] = info.size;
    }
    // HEAD and an unchanged preview asset need no file read or response buffer.
    if (req.method === 'HEAD') { res.writeHead(200, headers); res.end(); return; }
    let body = await readFile(path);
    if (watching && path.endsWith('index.html')) body = Buffer.from(body.toString().replace('</body>', `<script>let v;setInterval(async()=>{try{const n=await(await fetch('/__dev_version')).text();if(v&&v!==n)location.reload();v=n}catch{}},1000)</script></body>`));
    res.writeHead(200, headers);
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
if (watching) await build();
else await stat(resolve(dist, 'index.html')).catch(() => { throw new Error('Run npm run build first.'); });
server.listen(port, host, () => console.log(`Report: http://${host}:${server.address().port}${watching ? ' (watching; browser reloads after a successful build)' : ''}`));
if (watching) {
  const changed = () => { clearTimeout(timer); timer = setTimeout(() => build().catch(console.error), 150); };
  for (const dir of ['src', 'assets', 'source']) watch(resolve(root, dir), { recursive: true }, changed);
  watch(resolve(root, 'build.mjs'), changed);
}
