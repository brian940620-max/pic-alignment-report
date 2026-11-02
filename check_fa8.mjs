// 核對 src/fa8.js 與 MATLAB FA8_Lensed_PIC（export_fa8_golden.m 產生 fa8_golden.json）
// 用法：node check_fa8.mjs
import { readFileSync } from 'node:fs';
import { etaFA, tol1dB, peakFA } from './src/fa8.js';

const G = JSON.parse(readFileSync(new URL('./test/fixtures/fa8_golden.json', import.meta.url), 'utf8'));
const inst = G.inst;
let d = { center: 0, ch1: 0, inst: 0 };
G.pose.forEach((ps, i) => {
  const cmp = (key, piv, ins) => etaFA(ps, undefined, piv, ins).forEach((c, k) => { d[key] = Math.max(d[key], Math.abs(c.e - G['eta_' + key][i][k])); });
  cmp('center', 'center', null); cmp('ch1', 'ch1', null); cmp('inst', 'center', inst);
});
console.log(`etaFA 最大差（${G.pose.length} 個姿態 × 8 通道）：中心 ${d.center.toExponential(2)}、ch1 ${d.ch1.toExponential(2)}、隨機 FA ${d.inst.toExponential(2)}`);
console.log(`標稱 η = ${peakFA().toFixed(6)}（MATLAB 0.98361）`);
const names = ['X µm', 'Y µm', 'Z µm', 'tx °', 'ty °', 'tz °'];
let dt = 0;
for (let a = 0; a < 6; a++) {
  const sc = a < 3 ? 1 : 180 / Math.PI, w = tol1dB(a, true) * sc, s = a === 5 ? NaN : tol1dB(a, false) * sc;
  const [ms, mw] = G.tol[a];
  dt = Math.max(dt, Math.abs(w - mw), a === 5 ? 0 : Math.abs(s - ms));
  console.log(`${names[a].padEnd(5)} 單通道 ${s.toFixed(4)}（${ms ?? 'NaN'}）  陣列最差 ${w.toFixed(4)}（${mw.toFixed(4)}）`);
}
const ok = Math.max(d.center, d.ch1, d.inst) < 1e-12 && dt < 1e-4;
console.log(ok ? 'PASS' : 'FAIL'); process.exit(ok ? 0 : 1);
