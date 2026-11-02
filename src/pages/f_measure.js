// ⑥ 量測與效率（投影片版，3 張，快速帶過）：量測鏈、效率怎麼算（定義＋迴路法）、相對 vs 絕對
// 數字與出處只用 報告/邊緣耦合文獻重點整理.md；示意值一律標「示意」。深色版面，與 ④ 一致。
import { h, slider, fitCanvas, drawPlot, fmtPct } from '../ui.js';
import { eta, PRESETS } from '../physics.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const c of kids.flat(Infinity)) { if (c == null) continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return e;
};
const dbToEta = (db) => Math.pow(10, -db / 10);

// 深色配色（SVG 用）
const C = {
  box: '#111c33', boxLine: '#3d5a8a', ink: '#e8eefb', sub: '#93a6c6',
  light: '#ff8a3d', wg: '#4dabf7', ctrl: '#74a9ff', sig: '#51cf66', hid: '#ff6b6b', glow: '#ffb86b',
  chip: '#0c1424', chipLine: '#5b6f94',
};

const CSS = `
.fm-svg { display: block; }
.fm-svg text { font-family: var(--font); }
.fm-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.fm-kpi { background: rgba(255,255,255,.05); border: 1px solid rgba(140,170,230,.22); border-radius: 10px; padding: 10px 6px; text-align: center; }
.fm-kpi .lab { font-size: 14px; color: var(--stage-muted); }
.fm-kpi .big { font-size: 34px; color: #fff; }
.fm-eq { font-size: 21px; line-height: 1.6; color: #fff; }
.fm-eq .hl { color: var(--glow); font-weight: 700; }
.fm-tbl { border-collapse: collapse; width: 100%; font-size: 15.5px; }
.fm-tbl th, .fm-tbl td { border: 1px solid rgba(140,170,230,.25); padding: 5px 8px; text-align: center; font-family: var(--mono); }
.fm-tbl th { color: var(--stage-muted); font-weight: 400; } .fm-tbl td { color: #fff; }
.fm-tbl th:first-child, .fm-tbl td:first-child { font-family: var(--font); color: var(--stage-muted); }
.fm-ul { margin: 6px 0 0; padding-left: 22px; font-size: 19px; line-height: 1.5; color: var(--stage-ink); }
.fm-ul li { margin: 6px 0; }
.fm-read { font-size: 17px; line-height: 1.65; color: var(--stage-ink); }
.card.dark .btn.ghost { background: transparent; color: #cfe0ff; border-color: rgba(190,210,245,.5); }
`;

// ---- 投影片 1：量測鏈 ----
function chainSlide(body) {
  const W = 1500, H = 560;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'fm-svg', role: 'img', 'aria-label': '量測鏈示意圖', width: W, height: H });
  const mk = (id, col) => s('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, s('path', { d: 'M0 0 L10 5 L0 10 z', style: `fill:${col}` }));
  svg.append(s('defs', {}, mk('fm-aL', C.light), mk('fm-aC', C.ctrl), mk('fm-aS', C.sig), mk('fm-aH', C.hid)));

  const box = (x, y, w, hh, lines, { stroke = C.boxLine, sw = 2, fill = C.box, subCol = C.sub } = {}) => {
    svg.append(s('rect', { x, y, width: w, height: hh, rx: 10, style: `fill:${fill};stroke:${stroke}`, 'stroke-width': sw }));
    lines.forEach((ln, i) => svg.append(s('text', {
      x: x + w / 2, y: y + hh / 2 + (i - (lines.length - 1) / 2) * 26 + 7, 'text-anchor': 'middle',
      style: `fill:${i ? subCol : C.ink};font-size:${i ? 16 : 20}px;font-weight:${i ? 400 : 700}`,
    }, ln)));
  };
  const line = (d, col, m, dash = '') => svg.append(s('path', { d, style: `stroke:${col};fill:none`, 'stroke-width': 3, 'stroke-dasharray': dash, 'marker-end': m ? `url(#${m})` : '' }));
  const label = (x, y, t, col, anchor = 'middle', size = 16) => svg.append(s('text', { x, y, 'text-anchor': anchor, style: `fill:${col};font-size:${size}px;font-weight:600` }, t));

  // 第一列：光路（中心 y = 180）
  const Y = 180;
  box(20, 130, 150, 100, ['1550 nm', '光源']);
  box(210, 130, 150, 100, ['偏振', '控制器']);
  box(400, 130, 210, 100, ['透鏡光纖＋六軸平台', '唯一能控制的量'], { stroke: C.glow, sw: 3, subCol: C.glow });
  svg.append(s('rect', { x: 660, y: 115, width: 380, height: 130, rx: 8, style: `fill:${C.chip};stroke:${C.chipLine}`, 'stroke-width': 2 }));
  label(1030, 236, 'PIC 晶片', C.sub, 'end', 14);
  svg.append(s('path', { d: `M691 ${Y} L1040 ${Y}`, style: `stroke:${C.wg};fill:none`, 'stroke-width': 4 }));
  box(645, 145, 46, 70, ['端面'], { stroke: C.light, fill: '#2a1a0e' });
  box(760, 155, 220, 50, ['波導／迴路'], { stroke: C.wg, fill: '#0f2340' });
  box(1080, 130, 160, 100, ['輸出端', '光纖／PD']);
  box(1290, 130, 190, 100, ['功率計', '唯一看得到的量'], { stroke: C.sig, sw: 3, subCol: C.sig });
  [[170, 210], [360, 400], [610, 645], [691, 760], [980, 1080], [1240, 1290]].forEach(([a, b]) => line(`M${a} ${Y} L${b - 2} ${Y}`, C.light, 'fm-aL'));

  // 看不到的量：放在光路上方，各自一條直線指向位置，不和其他線交叉
  const pill = (cx, w, t, toY) => {
    svg.append(s('rect', { x: cx - w / 2, y: 38, width: w, height: 42, rx: 21, style: `fill:#2a0f14;stroke:${C.hid}`, 'stroke-width': 2, 'stroke-dasharray': '6 4' }));
    label(cx, 65, t, C.hid);
    line(`M${cx} 80 L${cx} ${toY}`, C.hid, 'fm-aH', '5 4');
  };
  pill(628, 200, '看不到：光點實際位置', 168);
  pill(870, 230, '看不到：剛進波導的功率', 153);

  // 第二列：回饋（中心 y = 445）
  box(1290, 400, 190, 90, ['擷取卡']);
  box(640, 400, 480, 90, ['控制程式', '繞圈梯度法：讀功率 → 估梯度 → 動平台']);
  line('M1385 230 L1385 398', C.sig, 'fm-aS');
  label(1397, 320, '電訊號', C.sig, 'start');
  line('M1290 445 L1122 445', C.sig, 'fm-aS');
  label(1205, 433, '讀值', C.sig);
  line('M640 445 L505 445 L505 232', C.ctrl, 'fm-aC');
  label(493, 345, '移動指令（XYZ、角度）', C.ctrl, 'end');

  // 圖例
  [[C.light, '', '光'], [C.sig, '', '電訊號／讀值'], [C.ctrl, '', '控制指令'], [C.hid, '5 4', '量不到的量']].forEach(([col, dash, t], i) => {
    const x = 20 + i * 190;
    svg.append(s('path', { d: `M${x} 540 L${x + 40} 540`, style: `stroke:${col}`, 'stroke-width': 3, 'stroke-dasharray': dash }));
    label(x + 50, 546, t, C.sub, 'start', 15);
  });

  body.append(h('div', { class: 'fill', style: { display: 'flex', alignItems: 'center', justifyContent: 'center' } }, svg));
}

// ---- 投影片 2：效率怎麼算（定義＋迴路法＋試算） ----
function efficiencySlide(body) {
  // 迴路示意（深色）
  const svg = s('svg', { viewBox: '0 0 640 230', class: 'fm-svg', role: 'img', 'aria-label': '迴路法示意', width: 640, height: 230 });
  svg.append(s('defs', {}, s('marker', { id: 'fm-aL2', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, s('path', { d: 'M0 0 L10 5 L0 10 z', style: `fill:${C.light}` }))));
  svg.append(s('rect', { x: 140, y: 40, width: 360, height: 100, rx: 8, style: `fill:${C.chip};stroke:${C.chipLine}`, 'stroke-width': 2 }));
  svg.append(s('path', { d: 'M140 90 L500 90', style: `stroke:${C.wg};fill:none`, 'stroke-width': 4 }));
  svg.append(s('text', { x: 320, y: 78, 'text-anchor': 'middle', style: `fill:${C.wg};font-size:16px` }, '波導迴路（PIC）'));
  [[140, '左端 η'], [500, '右端 η']].forEach(([x, t]) => {
    svg.append(s('rect', { x: x - 12, y: 62, width: 24, height: 56, rx: 4, style: `fill:#2a1a0e;stroke:${C.light}`, 'stroke-width': 2 }));
    svg.append(s('text', { x, y: 165, 'text-anchor': 'middle', style: `fill:${C.ink};font-size:17px` }, t));
  });
  svg.append(s('path', { d: 'M30 90 L124 90', style: `stroke:${C.light};fill:none`, 'stroke-width': 3, 'marker-end': 'url(#fm-aL2)' }));
  svg.append(s('path', { d: 'M514 90 L608 90', style: `stroke:${C.light};fill:none`, 'stroke-width': 3, 'marker-end': 'url(#fm-aL2)' }));
  svg.append(s('text', { x: 30, y: 74, style: `fill:${C.ink};font-size:17px` }, 'P_ref'));
  svg.append(s('text', { x: 560, y: 74, style: `fill:${C.ink};font-size:17px` }, 'P_out'));
  svg.append(s('text', { x: 320, y: 212, 'text-anchor': 'middle', style: `fill:${C.glow};font-size:19px;font-weight:700` }, 'P_out ÷ P_ref ＝ η × η × 波導穿透率　（兩端對稱）'));

  // 試算
  const st = { ref: 0, out: -5.7, prop: 0.1 };
  const ro = { total: h('div', { class: 'big' }), one: h('div', { class: 'big', style: { color: 'var(--glow)' } }), eta: h('div', { class: 'big', style: { color: '#ffa94d' } }) };
  const upd = () => {
    const total = st.ref - st.out;
    const one = Math.max(0, total - st.prop) / 2;
    ro.total.textContent = `${total.toFixed(2)} dB`;
    ro.one.textContent = `${one.toFixed(2)} dB`;
    ro.eta.textContent = fmtPct(dbToEta(one));
  };
  const sRef = slider({ label: '參考功率 P_ref（光纖直接接功率計）', min: -10, max: 10, step: 0.1, value: st.ref, unit: 'dBm', onInput: (v) => { st.ref = v; upd(); } });
  const sOut = slider({ label: '輸出功率 P_out（經過晶片迴路）', min: -40, max: 10, step: 0.1, value: st.out, unit: 'dBm', onInput: (v) => { st.out = v; upd(); } });
  const sProp = slider({ label: '波導傳播損耗（整段）', min: 0, max: 2, step: 0.05, value: st.prop, unit: 'dB', digits: 2, onInput: (v) => { st.prop = v; upd(); } });
  upd();
  const rows = [0.5, 1, 2, 3, 6];

  body.append(
    h('div', { class: 'grid g2 fill' },
      h('div', { class: 'card dark col', style: { gap: '16px', justifyContent: 'center' } },
        h('div', { class: 'fm-eq' },
          '耦合效率　', h('span', { class: 'hl' }, 'η ＝ 進入波導的功率 ÷ 光纖出光功率'), h('br'),
          '損耗（dB）＝ −10·log₁₀ η'),
        h('div', { style: { display: 'flex', justifyContent: 'center' } }, svg),
        h('div', { class: 'fm-eq' }, '單邊耦合損耗 ＝ ', h('span', { class: 'hl' }, '（總損耗 − 波導損耗）÷ 2')),
        h('table', { class: 'fm-tbl' },
          h('tr', {}, h('th', {}, '損耗'), ...rows.map((r) => h('th', {}, `${r} dB`))),
          h('tr', {}, h('td', {}, '效率'), ...rows.map((r) => h('td', {}, `${(dbToEta(r) * 100).toFixed(0)}%`))))),
      h('div', { class: 'card dark col', style: { gap: '16px', justifyContent: 'center' } },
        h('h3', { style: { margin: 0, fontSize: '20px' } }, '代入試算'),
        sRef.el, sOut.el, sProp.el,
        h('div', { class: 'row' },
          h('button', { class: 'btn ghost', type: 'button', onclick: () => { sRef.set(0); sOut.set(-5.7); sProp.set(0.1); } }, '代入 Gradkowski 2024 例（單邊 2.8 dB）')),
        h('div', { class: 'fm-kpis' },
          h('div', { class: 'fm-kpi' }, h('div', { class: 'lab' }, '量到的總損耗'), ro.total),
          h('div', { class: 'fm-kpi' }, h('div', { class: 'lab' }, '單邊耦合損耗'), ro.one),
          h('div', { class: 'fm-kpi' }, h('div', { class: 'lab' }, '耦合效率 η'), ro.eta)))),
    h('p', { class: 'src', style: { margin: 0 } },
      '迴路法：L. Carroll et al., Applied Sciences 6(12), 426 (2016), Fig. 6。邊緣耦合器單點平均 2.8 dB：Gradkowski et al., J. Phys.: Photonics 6, 035022 (2024)。'));
}

// ---- 投影片 3：相對 vs 絕對 ----
function relAbsSlide(body) {
  const P = PRESETS.lensedSSC.p;
  const st = { err: 1.5 };
  const xs = [], y0 = [];
  for (let i = 0; i <= 160; i++) { const x = -4 + (8 * i) / 160; xs.push(x); y0.push(eta(P, { dx: x, dy: 0, gap: P.WD, tx: 0, ty: 0 })); }
  const cv = h('canvas', { class: 'cv', style: { height: '100%' } });
  const out = h('div', { class: 'fm-read' });
  const draw = (g) => {
    const f = Math.pow(10, st.err / 10);
    drawPlot(g, {
      xlim: [-4, 4], ylim: [0, Math.max(1.2, f * 1.1)], xlabel: '光纖橫向位置 X（µm）', ylabel: '功率計讀值（相對 P_ref）',
      series: [{ x: xs, y: y0, color: '#8a8fa3', width: 2, dash: [6, 4], label: '真實耦合效率' }, { x: xs, y: y0.map((v) => v * f), color: '#e8590c', width: 2.6, label: '讀值（刻度有誤差）' }],
      vlines: [{ x: 0, color: '#2f9e44', label: '峰值位置：兩條相同' }],
      points: [{ x: 0, y: 1, color: '#8a8fa3', r: 4 }, { x: 0, y: f, color: '#e8590c', r: 5, ring: true }],
    });
    out.innerHTML = `<b>對位：</b>兩條曲線的峰值都在 X ＝ 0 → <span style="color:#69db7c">位置不受刻度誤差影響</span>。<br><b>效率：</b>真實 ${fmtPct(1)}，讀值峰值卻顯示 <span style="color:#ffa94d">${fmtPct(f)}</span> → 絕對效率會被誤判。`;
  };
  const g = fitCanvas(cv, draw);
  const sErr = slider({ label: '功率計刻度／參考功率誤差', min: -3, max: 3, step: 0.1, value: st.err, unit: 'dB', onInput: (v) => { st.err = v; if (g.w) draw(g); } });
  const side = (col, title, items) => h('div', { class: 'card dark', style: { borderColor: col } },
    h('h3', { style: { margin: 0, color: col, fontSize: '21px' } }, title),
    h('ul', { class: 'fm-ul' }, ...items.map((t) => h('li', {}, t))));
  body.append(
    h('div', { class: 'grid g2', style: { flex: 'none' } },
      side('#69db7c', '對位：只要相對功率', [
        '繞圈梯度法只比較「哪邊比較亮」，找的是峰值位置。',
        '光源穩、讀值重複性好就夠；刻度不準不影響對位。']),
      side('#ffa94d', '報告效率：需要絕對校正', [
        '要有參考功率（光纖直接接功率計）。',
        '用迴路對稱扣掉另一端耦合與波導損耗。',
        '波長、偏振、連接器固定，才能和文獻數字比較。'])),
    h('div', { class: 'grid g32 fill' },
      h('div', { class: 'card col' }, h('div', { class: 'fill' }, cv)),
      h('div', { class: 'card dark col', style: { gap: '12px' } },
        h('h3', { style: { margin: 0, fontSize: '20px' } }, '刻度有誤差時，對位會變嗎？'), sErr.el, out,
        h('p', { class: 'src', style: { margin: 'auto 0 0' } }, '曲線：本專案高斯模型（透鏡光纖→SSC 3 µm，示意參數）的橫向偏移曲線；刻度誤差是假設的比例係數。'))));
  return { show() { g.apply(); } };
}

export function mount(sec) {
  sec.el.append(h('style', {}, CSS));
  sec.slide({ title: '量測鏈：控制的是位置，量到的是功率' }, chainSlide);
  sec.slide({ title: '耦合效率怎麼算', sub: '量不到剛進波導的功率 → 用迴路兩端對稱反推' }, efficiencySlide);
  sec.slide({ title: '對位看相對功率，報告效率才要校正' }, relAbsSlide);
}
