// 分頁 ② PIC 邊緣耦合的第一張：三個重點＋三張示意圖（其餘投影片由 a_f2f.js 插入，見 main.js）
// 三張圖 2026-10-29 重畫（立體圓管、高斯光暈、標籤膠囊、尺寸標線）；要說明的內容與數字不變。
import { h } from '../ui.js';
import { eta } from '../physics.js';

const COL = { fiber: '#e8590c', wg: '#2b6cb0', ex: '#2f9e44' };
const svg = (w, hgt, inner) => h('div', { class: 'ill', html: `<svg viewBox="0 0 ${w} ${hgt}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" font-family="system-ui, 'Microsoft JhengHei', sans-serif">${inner}</svg>` });

// 共用的 SVG 小元件（id 都加 b1- 前綴，避免和其他頁的 <defs> 撞名）
const INK = '#1c2b3d', SUB = '#5b6b80';
const pill = (x, y, text, fg, bg, fs = 13.5) => {
  const w = text.length * fs * 0.98 + 22;
  return `<g transform="translate(${x - w / 2},${y - 13})"><rect width="${w}" height="26" rx="13" fill="${bg}"/><text x="${w / 2}" y="17.5" font-size="${fs}" font-weight="700" fill="${fg}" text-anchor="middle">${text}</text></g>`;
};
const dim = (x1, x2, y, label, col = SUB) => `<g stroke="${col}" stroke-width="1.3"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/>
  <line x1="${x1}" y1="${y - 5}" x2="${x1}" y2="${y + 5}"/><line x1="${x2}" y1="${y - 5}" x2="${x2}" y2="${y + 5}"/></g>
  <text x="${(x1 + x2) / 2}" y="${y + 17}" font-size="12.5" fill="${col}" text-anchor="middle">${label}</text>`;
const DEFS = `<defs>
  <linearGradient id="b1-pipe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d7fb5"/><stop offset=".28" stop-color="#a9c3ea"/><stop offset=".55" stop-color="#7393c6"/><stop offset="1" stop-color="#3d5c8f"/></linearGradient>
  <linearGradient id="b1-straw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9b2c22"/><stop offset=".4" stop-color="#e46a5c"/><stop offset="1" stop-color="#8a241b"/></linearGradient>
  <radialGradient id="b1-hole" cx=".45" cy=".5" r=".6"><stop offset="0" stop-color="#0a1626"/><stop offset="1" stop-color="#22385a"/></radialGradient>
  <linearGradient id="b1-flow" x1="0" x2="1"><stop offset="0" stop-color="#ff8a3d" stop-opacity=".85"/><stop offset="1" stop-color="#ffb26b" stop-opacity=".35"/></linearGradient>
  <linearGradient id="b1-beam" x1="0" x2="1"><stop offset="0" stop-color="#ff8a3d" stop-opacity=".18"/><stop offset="1" stop-color="#ff7a1a" stop-opacity=".95"/></linearGradient>
  <radialGradient id="b1-glow"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".35" stop-color="#ffb26b" stop-opacity=".9"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient>
  <linearGradient id="b1-clad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9cde8"/><stop offset=".5" stop-color="#e3edf9"/><stop offset="1" stop-color="#a5bcdc"/></linearGradient>
  <linearGradient id="b1-core" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a52"/><stop offset=".5" stop-color="#ffc58f"/><stop offset="1" stop-color="#ff9a52"/></linearGradient>
  <linearGradient id="b1-lens" x1="0" x2="1"><stop offset="0" stop-color="#fff4dc"/><stop offset=".5" stop-color="#ffe0a8"/><stop offset="1" stop-color="#f3c97a"/></linearGradient>
  <linearGradient id="b1-chipTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f7fc"/><stop offset="1" stop-color="#dbe3ef"/></linearGradient>
  <linearGradient id="b1-chipSide" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9d4e4"/><stop offset="1" stop-color="#a9b8cd"/></linearGradient>
  <linearGradient id="b1-ssc" x1="0" x2="1"><stop offset="0" stop-color="#2b6cb0" stop-opacity=".35"/><stop offset="1" stop-color="#1f5fa8"/></linearGradient>
  <radialGradient id="b1-spB"><stop offset="0" stop-color="#2b6cb0" stop-opacity=".8"/><stop offset=".55" stop-color="#2b6cb0" stop-opacity=".32"/><stop offset="1" stop-color="#2b6cb0" stop-opacity="0"/></radialGradient>
  <radialGradient id="b1-spO"><stop offset="0" stop-color="#e8590c" stop-opacity=".8"/><stop offset=".55" stop-color="#e8590c" stop-opacity=".32"/><stop offset="1" stop-color="#e8590c" stop-opacity="0"/></radialGradient>
  <marker id="b1-ar" markerWidth="9" markerHeight="9" refX="6.5" refY="4.5" orient="auto"><path d="M0,0.5 L8,4.5 L0,8.5 L2,4.5 z" fill="#ff7a1a"/></marker>
  <marker id="b1-ab" markerWidth="9" markerHeight="9" refX="6.5" refY="4.5" orient="auto"><path d="M0,0.5 L8,4.5 L0,8.5 L2,4.5 z" fill="#1f5fa8"/></marker>
  <filter id="b1-sh" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="2.5" stdDeviation="2.5" flood-color="#1c2b3d" flood-opacity=".22"/></filter>
</defs>`;

// ① 水管對水管、水管對吸管（立體圓管＋光流；吸管只接到一小部分，其餘漏掉）
function pipes() {
  const tube = (x, y, w, r, openRight) => {
    const rx = Math.max(3, r * 0.3);
    return `<g filter="url(#b1-sh)"><rect x="${x}" y="${y - r}" width="${w}" height="${2 * r}" fill="url(#b1-pipe)"/>
      <ellipse cx="${openRight ? x : x + w}" cy="${y}" rx="${rx}" ry="${r}" fill="url(#b1-pipe)"/>
      <ellipse cx="${openRight ? x + w : x}" cy="${y}" rx="${rx}" ry="${r}" fill="url(#b1-hole)" stroke="#a9c3ea" stroke-width="1.5"/></g>`;
  };
  const flow = (x0, x1, y, r, n) => `<rect x="${x0}" y="${y - r * 0.82}" width="${x1 - x0}" height="${1.64 * r}" fill="url(#b1-flow)" opacity=".35"/>` +
    Array.from({ length: n }, (_, k) => { const yy = y - r * 0.6 + (1.2 * r * k) / Math.max(1, n - 1); return `<line x1="${x0 + 4}" y1="${yy}" x2="${x1 - 2}" y2="${yy}" stroke="#ff7a1a" stroke-width="2.6" stroke-linecap="round" marker-end="url(#b1-ar)"/>`; }).join('');
  const spill = (sx, sy, ex, ey) => `<path d="M${sx} ${sy} Q${(sx + ex) / 2 + 8} ${sy} ${ex} ${ey}" stroke="#ff7a1a" stroke-opacity=".6" fill="none" stroke-width="2.2" stroke-dasharray="5 4" stroke-linecap="round" marker-end="url(#b1-ar)"/>`;
  return svg(400, 330, `${DEFS}
    <text x="12" y="24" font-size="16.5" font-weight="800" fill="${INK}">光纖對光纖：水管對水管</text>
    ${tube(14, 84, 132, 36, true)} ${flow(150, 236, 84, 36, 4)} ${tube(252, 84, 134, 36, false)}
    ${pill(200, 142, '✓ 大小一樣 → 幾乎全部接得住', '#1f7a35', '#d8f0dd')}
    <line x1="14" y1="172" x2="386" y2="172" stroke="#c9d3e2" stroke-dasharray="3 5"/>
    <text x="12" y="200" font-size="16.5" font-weight="800" fill="${INK}">光纖對 PIC：水管對吸管</text>
    ${tube(14, 256, 132, 36, true)} ${flow(150, 238, 256, 36, 4)}
    <g filter="url(#b1-sh)"><rect x="252" y="251" width="134" height="10" rx="2" fill="url(#b1-straw)"/><ellipse cx="252" cy="256" rx="2.5" ry="5" fill="#3a0d09"/></g>
    ${spill(238, 228, 262, 206)} ${spill(238, 284, 262, 306)}
    ${pill(330, 226, '✗ 大部分漏掉', '#a3261b', '#fbdcd8')}
    ${dim(14, 146, 302, '光纖模場 10.4 µm')}
    <text x="320" y="282" font-size="12.5" fill="${SUB}" text-anchor="middle">PIC 波導 0.45 µm</text>`);
}

// ② 簡化架構：光纖 → 透鏡（縮小光斑）→ 焦點 ← SSC（放大模場）← PIC 波導
function arch() {
  return svg(400, 420, `${DEFS}
    <text x="56" y="70" font-size="15" font-weight="800" fill="${INK}" text-anchor="middle">光纖</text>
    <text x="136" y="70" font-size="15" font-weight="800" fill="${INK}" text-anchor="middle">透鏡</text>
    <text x="312" y="54" font-size="15" font-weight="800" fill="${INK}" text-anchor="middle">PIC 晶片</text>
    <g filter="url(#b1-sh)"><rect x="18" y="118" width="76" height="64" rx="4" fill="url(#b1-clad)" stroke="#8ea6c8"/>
      <rect x="18" y="138" width="76" height="24" fill="url(#b1-core)"/></g>
    <path d="M94 138 C150 138 190 145 234 147 L234 153 C190 155 150 162 94 162 Z" fill="url(#b1-beam)"/>
    <path d="M136 102 Q151 150 136 198 Q121 150 136 102 Z" fill="url(#b1-lens)" stroke="#d9a050" stroke-width="1.8"/>
    <g filter="url(#b1-sh)"><path d="M238 100 L250 88 L390 88 L390 202 L378 214 L238 214 Z" fill="url(#b1-chipSide)"/>
      <path d="M238 100 L250 88 L390 88 L378 100 Z" fill="url(#b1-chipTop)" stroke="#8d9ab0"/>
      <rect x="238" y="100" width="140" height="114" fill="url(#b1-chipTop)" stroke="#8d9ab0"/></g>
    <path d="M238 141 L300 148 L300 152 L238 159 Z" fill="url(#b1-ssc)"/>
    <rect x="300" y="148.5" width="78" height="3" rx="1.5" fill="#1f5fa8"/>
    <text x="266" y="188" font-size="14" font-weight="800" fill="#1f5fa8" text-anchor="middle">SSC</text>
    <text x="337" y="128" font-size="13" fill="#1f5fa8" text-anchor="middle">PIC 波導</text>
    <circle cx="234" cy="150" r="13" fill="url(#b1-glow)"/><circle cx="234" cy="150" r="3" fill="#fff" stroke="#e8590c" stroke-width="1.6"/>
    <path d="M234 168 V232 H200 V240" fill="none" stroke="#43885e" stroke-width="1.4" stroke-dasharray="3 4"/>
    ${pill(200, 258, '兩側匹配：約 3 µm', '#1f7a35', '#d8f0dd', 14)}
    <rect x="14" y="296" width="178" height="100" rx="14" fill="#fff0e1" stroke="#ead2bc"/>
    <rect x="208" y="296" width="178" height="100" rx="14" fill="#e2edf9" stroke="#bdcfe4"/>
    <g text-anchor="middle" font-size="14" font-weight="700">
      <text x="103" y="323" fill="#b55116">光纖側 · 透鏡聚焦</text>
      <text x="297" y="323" fill="#1f5fa8">晶片側 · SSC 展開</text>
      <text x="103" y="352" fill="${INK}">10.4 → 約 3 µm</text>
      <text x="297" y="352" fill="${INK}">0.45 → 約 3 µm</text>
    </g>
    <line x1="54" y1="375" x2="150" y2="375" stroke="#e8590c" stroke-width="2" marker-end="url(#b1-ar)"/>
    <line x1="346" y1="375" x2="250" y2="375" stroke="#1f5fa8" stroke-width="2" marker-end="url(#b1-ab)"/>`);
}

// ③ 同樣偏移，大模場接收端與小模場接收端（光斑用高斯光暈；百分比由重疊積分算）
function compare() {
  const d = 1.5, s = 60 / 5.2;                        // 5.2 µm ↔ 60 px（大模場光暈才不會壓到下方文字）
  const cell = (cx, w, label) => {
    const e = eta({ wf: w, WD: 0, wgx: w, wgy: w }, { dx: d, dy: 0, gap: 0, tx: 0, ty: 0 });
    const col = e > 0.8 ? '#1f7a35' : e > 0.5 ? '#a86a12' : '#a3261b', bg = e > 0.8 ? '#d8f0dd' : e > 0.5 ? '#fbedd2' : '#fbdcd8';
    const r = w * s, cy = 116, bw = 120;
    return `<text x="${cx}" y="26" font-size="15.5" font-weight="800" fill="${INK}" text-anchor="middle">${label}</text>
      <circle cx="${cx}" cy="${cy}" r="${r * 1.15}" fill="url(#b1-spB)"/>
      <circle cx="${cx + d * s}" cy="${cy}" r="${r * 1.15}" fill="url(#b1-spO)" style="mix-blend-mode:multiply"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#2b6cb0" stroke-width="2" stroke-dasharray="5 3"/>
      <circle cx="${cx + d * s}" cy="${cy}" r="${r}" fill="none" stroke="#e8590c" stroke-width="2"/>
      <circle cx="${cx}" cy="${cy}" r="2.4" fill="#2b6cb0"/><circle cx="${cx + d * s}" cy="${cy}" r="2.4" fill="#e8590c"/>
      ${dim(cx, cx + d * s, cy + Math.max(r, 12) + 14, `偏 ${d} µm`, INK)}
      <text x="${cx}" y="262" font-size="32" font-weight="800" fill="${col}" text-anchor="middle" font-family="Consolas, monospace">${(e * 100).toFixed(0)}%</text>
      <rect x="${cx - bw / 2}" y="272" width="${bw}" height="9" rx="4.5" fill="#dfe6f0"/><rect x="${cx - bw / 2}" y="272" width="${bw * e}" height="9" rx="4.5" fill="${col}"/>
      ${pill(cx, 304, `模場 ${2 * w} µm（剩下的效率）`, col, bg, 12)}`;
  };
  return svg(400, 330, DEFS + cell(100, 5.2, '大模場（光纖）') + cell(300, 1.5, '小模場（PIC SSC）') +
    '<line x1="200" y1="40" x2="200" y2="318" stroke="#c9d3e2" stroke-dasharray="3 5"/>' +
    `<g font-size="11.5" fill="${SUB}"><circle cx="160" cy="324" r="4" fill="#2b6cb0" opacity=".7"/><text x="168" y="328">接收端</text><circle cx="214" cy="324" r="4" fill="#e8590c" opacity=".8"/><text x="222" y="328">入射光</text></g>`);
}

export function mount(sec) {
  sec.slide({ title: 'PIC 邊緣耦合：把光從光纖送進晶片側面', sub: '' }, (body) => {
    body.closest('.slide').classList.add('edge-ui', 'edge-intro');
    body.append(h('style', null, '.ill { flex:1; min-height:0; display:flex; align-items:center; justify-content:center; background:#f6f8fc; border-radius:12px; padding:8px; }'));
    const card = (n, title, text, ill, color) => h('div', { class: 'card', style: { borderTop: '6px solid ' + color, display: 'flex', flexDirection: 'column', gap: '10px', padding: '18px 22px' } },
      h('div', { class: 'row', style: { gap: '12px', alignItems: 'center', minHeight: '40px' } }, h('span', { style: { fontSize: '40px', fontWeight: 700, color, lineHeight: 1 } }, n), h('h2', { style: { fontSize: '24px', margin: 0 } }, title)),
      h('div', { style: { fontSize: '19px', fontWeight: 700, color: '#c6d6e8' } }, text), ill);   // 計畫版：每張卡只留一句
    body.append(
      h('div', { class: 'grid g3 grow', style: { gridTemplateRows: '1fr' } },
        card('①', '模場差一個數量級', '光纖 10.4 µm vs PIC 波導 0.45 µm', pipes(), COL.fiber),
        card('②', '兩側都縮到約 3 µm', '透鏡縮光斑＋SSC 放大模場', arch(), COL.wg),
        card('③', '光點小 → 次微米容差', '1 dB 橫向容差約 ±0.5 µm', compare(), COL.ex)));
  });
}
