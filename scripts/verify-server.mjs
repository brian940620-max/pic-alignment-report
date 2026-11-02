// Exercise the local preview over HTTP without using or interrupting the dev port.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const child = spawn(process.execPath, ['scripts/serve.mjs'], {
  cwd: root, env: { ...process.env, PORT: '0', HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'],
});
try {
  const url = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Preview startup timed out')), 10000);
    const finish = (fn, value) => { clearTimeout(timer); fn(value); };
    child.once('error', e => finish(reject, e));
    child.once('exit', code => finish(reject, new Error(`Preview exited ${code}`)));
    child.stderr.on('data', data => { output += data; });
    child.stdout.on('data', data => {
      output += data;
      const match = output.match(/Report: (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) finish(resolve, match[1]);
    });
  });
  const request = (path, options = {}) => fetch(url + path, { ...options, signal: AbortSignal.timeout(10000) });
  const get = await request('/');
  assert.equal(get.status, 200);
  assert.equal(get.headers.get('cache-control'), 'no-cache');
  const etag = get.headers.get('etag');
  assert.ok(etag);
  const body = Buffer.from(await get.arrayBuffer());
  assert.deepEqual(body, await readFile(new URL('../dist/index.html', import.meta.url)));
  const head = await request('/', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(Number(head.headers.get('content-length')), body.length);
  assert.equal(head.headers.get('etag'), etag);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  const unchanged = await request('/', { headers: { 'If-None-Match': `"old", ${etag}` } });
  assert.equal(unchanged.status, 304);
  assert.equal((await unchanged.arrayBuffer()).byteLength, 0);
  const stale = await request('/', { headers: { 'If-None-Match': '"old"' } });
  assert.equal(stale.status, 200);
  await stale.arrayBuffer();
  const missing = await request('/missing-preview-asset.png');
  assert.equal(missing.status, 404);
  await missing.text();
  const post = await request('/', { method: 'POST' });
  assert.equal(post.status, 405);
  await post.text();
  console.log('PASS: preview GET, HEAD, ETag revalidation, stale cache, 404 and 405.');
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit'); child.kill(); await exited;
  }
}
