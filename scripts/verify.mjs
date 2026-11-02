import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const files = (dir) => readdirSync(dir).flatMap(n => statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]);
const html = readFileSync('dist/index.html', 'utf8');
assert.match(html, /PIC 邊緣耦合/);
assert(!html.includes('/*CSS*/') && !html.includes('/*JS*/'), 'Build placeholders remain');
assert(existsSync('dist/platform_embed.html'), '3D platform missing');
assert(existsSync('dist/THIRD_PARTY_NOTICES.txt'), 'License notices missing');
let count = 0;
for (const path of files('src').filter(f => /\.(js|css)$/.test(f))) {
  const text = readFileSync(path, 'utf8');
  for (const m of text.matchAll(/['"](assets\/[^'"\s]+)['"]/g)) {
    assert(existsSync(join('dist', m[1])), `${path}: missing ${m[1]}`); count++;
  }
  assert(!/['"]\.\.\/(?:StAmant_XYZ_Field|Z_alignment_sim|平台硬體)/.test(text), `Nonportable path in ${path}`);
}
const platform = readFileSync('dist/platform_embed.html', 'utf8');
const images = [...platform.matchAll(/platform_img\/[\w.+-]+\.(?:png|jpe?g|webp|gif)/g)].map(m => m[0]);
assert(images.length >= 60, 'Platform photos were not extracted');
for (const image of images) assert(existsSync(join('dist', image)), `Missing ${image}`);
assert(!/https:\/\/(?:unpkg|cdn\.jsdelivr)/.test(html + platform), 'Runtime CDN dependency');
const bytes = files('dist').reduce((sum, f) => sum + statSync(f).size, 0);
assert(bytes < 1_000_000_000, 'GitHub Pages 1 GB limit exceeded');
console.log(`PASS: ${count} report asset references, ${new Set(images).size} hardware photos, ${(bytes / 1024 / 1024).toFixed(1)} MiB deployable output; no sibling-project dependency.`);
