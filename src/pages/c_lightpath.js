// 分頁 ③：光怎麼走進 PIC（3 張投影片）：3D 三種透鏡放法（光路每 9 秒重播，同封面）；透鏡光纖；端面反射的 FP 漣漪
//   1) 位置、焦平面、方向：側視＋端面視＋滑桿＋即時耦合效率
import { h, slider, segmented, fitCanvas, loop, fmtLen, fmtDb, fmtPct, clamp, DEG } from '../ui.js';
import { eta, toDb, lossDb, tolerance1dB, PRESETS, beamAt, K0, LAMBDA } from '../physics.js';
import { drawSide, drawFacet, drawMeter } from '../microview.js';
import { Couple3D, C3D_CSS } from '../couple3d.js';
import { CASES, CASE_IDS, LAYER_NAMES } from '../optics3.js';

const CSS = `
.cond { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; flex:none; }
.cond > div { border:1px solid rgba(140,170,230,.25); border-radius:12px; padding:6px 14px; background:rgba(12,20,38,.8); color:#e8eefb; transition:border-color .2s, box-shadow .2s; height:84px; backdrop-filter:blur(6px); }
.cond > div.ok { border-color:rgba(105,219,124,.7); box-shadow:inset 0 0 0 1px rgba(105,219,124,.35), 0 0 18px rgba(105,219,124,.15); }
.cond > div.bad { border-color:rgba(255,120,90,.75); box-shadow:inset 0 0 0 1px rgba(255,120,90,.35), 0 0 18px rgba(255,120,90,.15); }
.cond b { color:#ffb86b; font-size:16px; } .cond .v { font-family:var(--mono); font-size:16px; line-height:1.3; color:#fff; } .cond .small.muted { color:var(--stage-muted); }
.cond .st { float:right; font-size:12.5px; font-weight:700; } .cond .ok .st { color:#69db7c; } .cond .bad .st { color:#ff8a70; }
.spec { display:flex; gap:8px; margin:6px 0; } .spec span { flex:1; text-align:center; background:#f1f5fb; border-radius:10px; padding:6px 4px; font-size:13px; color:var(--muted); }
.spec b { display:block; font-family:var(--mono); font-size:19px; color:var(--beam); }
.cpick { display:flex; flex-direction:column; gap:8px; }
.cpick button { display:flex; gap:12px; align-items:center; text-align:left; background:rgba(255,255,255,.04); border:1px solid rgba(140,170,230,.25); border-radius:12px; padding:9px 12px; color:#dfe8fa; cursor:pointer; transition:.2s; }
.cpick button:hover { border-color:rgba(255,184,107,.6); }
.cpick button.on { background:linear-gradient(135deg, rgba(255,138,61,.28), rgba(255,138,61,.08)); border-color:#ffb86b; box-shadow:0 0 18px rgba(255,138,61,.25); color:#fff; }
.cpick .t { flex:none; width:36px; height:36px; border-radius:10px; background:rgba(255,184,107,.18); color:#ffb86b; font-weight:800; font-size:19px; display:flex; align-items:center; justify-content:center; }
.cpick button.on .t { background:#ffb86b; color:#1a1206; }
.cpick b { display:block; font-size:17px; } .cpick small { color:var(--stage-muted); font-size:13.5px; }
.lstrip { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
.lstrip > div { white-space:pre-line; text-align:center; font-size:13.5px; line-height:1.35; color:#93a6c6; border:1px dashed rgba(140,170,230,.35); border-radius:10px; padding:6px 4px; }
.lstrip > div.on { color:#fff; border:1px solid #ffb86b; background:rgba(255,138,61,.16); box-shadow:0 0 14px rgba(255,138,61,.25); }
.lstrip i { display:block; font-style:normal; font-weight:700; color:#ffb86b; min-height:18px; }
.bk { display:grid; grid-template-columns:96px 1fr 70px; gap:8px; align-items:center; font-size:15px; margin:5px 0; }
.bk .bar > i { background:#2b6cb0; }
.phase { display:inline-block; padding:2px 12px; border-radius:99px; font-size:14.5px; font-weight:600; background:#eef2f8; color:var(--accent); }
.phase.spiral { background:#fde8d8; color:#a8470b; } .phase.circle, .phase.zprobe, .phase.move { background:#dbeafe; color:#1d4f91; } .phase.hold { background:#dcf3e1; color:#237a3a; }
.relv { position:relative; }
.relv .ov { position:absolute; right:8px; top:8px; z-index:2; }
`;

export function mount(sec) {
  const presetId = 'lensedSSC';      // 本分頁只看透鏡光纖
  const p = { ...PRESETS[presetId].p };
  const startPose = () => ({ dx: 2.0, dy: -1.5, gap: p.WD + 6, tx: 0, ty: 0 });
  let pose = startPose();
  let tol = {};
  let zoomMode = 'near';
  let hw = 6;
  const trail = [];
  const sls = { dx: [], dy: [], gap: [], tx: [], ty: [] };       // 各投影片的滑桿，同步用
  const V = { s1: null };                    // 各投影片的畫布與元件（建好才有）
  let active = 0;
  let styleAdded = false;
  const addStyle = (body) => { if (!styleAdded) { body.append(h('style', null, CSS)); styleAdded = true; } };
  const recompute = () => { tol = { x: tolerance1dB(p, 'x'), y: tolerance1dB(p, 'y'), z: tolerance1dB(p, 'z'), t: tolerance1dB(p, 'tx') }; };
  recompute();

  const mk = (key, label, min, max, step, unit, digits, scale = 1) => {
    const s = slider({ label, min, max, step, value: 0, unit, digits, onInput: (v) => { pose[key] = v * scale; syncSliders(); draw(); } });
    s.scale = scale; sls[key].push(s);
    return s.el;
  };
  function syncSliders() {
    for (const k of Object.keys(sls)) for (const s of sls[k]) s.set(pose[k] / s.scale, true);
  }
  function setGapRange() { for (const s of sls.gap) { const i = s.el.querySelector('input'); i.min = Math.max(0, p.WD - 40); i.max = p.WD + 80; } }

  const zoomView = () => { const near = zoomMode === 'near'; return { zmin: -(p.WD + (near ? 38 : 100)), zmax: near ? 16 : 30, xhw: near ? 11 : 28 }; };

  // ===================== 投影片 0：3D 光路，三種透鏡位置 =====================
  sec.slide({ title: '光怎麼走進晶片：三種透鏡放法', sub: '' }, (body) => {
    addStyle(body);
    body.closest('.slide').classList.add('edge-ui', 'lightpath-ui');
    body.append(h('style', null, C3D_CSS));
    const holder = h('div', { class: 'c3d', style: { height: '100%' } });
    const say = h('div', { class: 'lightpath-explanation', 'aria-live': 'polite', style: { fontSize: '19px', lineHeight: 1.6 } });
    const strip = h('div', { class: 'lstrip' });
    const btns = {};
    const pick = h('div', { class: 'cpick' }, CASE_IDS.map((id) => (btns[id] = h('button', { type: 'button', onclick: () => c3.setCase(id) },
      h('span', { class: 't' }, CASES[id].tag), h('span', null, h('b', null, CASES[id].name), h('small', null, `透鏡在第 ${CASES[id].layer} 層`))))));
    const onCase = (id) => {
      const c = CASES[id];
      for (const k of CASE_IDS) { btns[k].classList.toggle('on', k === id); btns[k].setAttribute('aria-pressed', String(k === id)); }
      say.replaceChildren(h('b', { style: { color: '#ffb86b' } }, c.lensName), '：', c.say);
      strip.replaceChildren(...LAYER_NAMES.map((n, i) => h('div', { class: i + 1 === c.layer ? 'on' : '' }, h('i', null, i + 1 === c.layer ? '透鏡' : ''), n.replace('：', '\n'))));
    };
    const c3 = new Couple3D(holder, { caseId: 'lensed', onCase, hq: true });
    onCase('lensed');
    body.append(h('div', { class: 'grid grow lightpath-layout' },
      h('div', { class: 'card dark lightpath-scene', style: { padding: '6px' } }, holder),   // 計畫版拿掉「拖曳旋轉視角 · 滾輪縮放」
      h('div', { class: 'card dark col lightpath-panel', style: { gap: '12px' } },
        pick, say,   // 計畫版拿掉「沿 Z 的三層」說明與層條
        h('div', { class: 'row lightpath-actions' },
          h('button', { class: 'btn ghost', type: 'button', onclick: () => c3.replay() }, '重播光路'),
          h('button', { class: 'btn ghost', type: 'button', onclick: () => c3.resetView() }, '視角重置')))));
    let timer = 0;   // 光路自動重複播放（同封面：每 9 秒重播）
    return { show() { c3.start(); clearInterval(timer); timer = setInterval(() => c3.replay(), 9000); }, hide() { c3.stop(); clearInterval(timer); } };
  });

  // ===================== 投影片 1 =====================
  sec.slide({ title: '透鏡光纖：把聚焦點送進波導', sub: '位置、焦平面、方向；拖滑桿看耦合效率怎麼變' }, (body) => {
    addStyle(body);
    body.closest('.slide').classList.add('edge-ui', 'alignment-ui');
    const condBox = h('div', { class: 'cond' });
    const sideCv = h('canvas', { class: 'cv', style: { height: '330px' } });
    const facetCv = h('canvas', { class: 'cv', style: { height: '330px' } });
    const zoomSeg = segmented([{ id: 'near', label: '近距離' }, { id: 'far', label: '寬視野' }], zoomMode, (id) => { zoomMode = id; draw(); });
    zoomSeg.el.classList.add('ov');
    const bigEta = h('div', { class: 'big' }), bigDb = h('div', { class: 'mono muted' });
    const meterCv = h('canvas', { style: { width: '100%', height: '32px', display: 'block' } });
    const note = h('div', { class: 'small muted' });
    body.append(condBox,
      h('div', { class: 'grid alignment-views', style: { gridTemplateColumns: '2.1fr 1fr', flex: 'none' } },
        h('div', { class: 'relv' }, sideCv, zoomSeg.el), facetCv),
      h('div', { class: 'card dark fill alignment-controls', style: { display: 'grid', gridTemplateColumns: '1.25fr 1fr 1fr 0.8fr', gap: '18px', alignContent: 'start' } },
        h('div', null, h('h3', null, '透鏡光纖 → SSC'),
          h('div', { class: 'spec' }, h('span', null, h('b', null, '3 µm'), '光點'), h('span', null, h('b', null, '30 µm'), '工作距離'), h('span', null, h('b', null, '3×3 µm'), 'SSC')),
          note,
          h('div', { class: 'row', style: { marginTop: '8px' } },
            h('button', { class: 'btn ghost', type: 'button', onclick: () => { pose = { dx: 0, dy: 0, gap: p.WD, tx: 0, ty: 0 }; syncSliders(); draw(); } }, '最佳位置'),
            h('button', { class: 'btn ghost', type: 'button', onclick: () => { pose = startPose(); syncSliders(); draw(); } }, '起始誤差'))),
        h('div', null, mk('dx', '橫向偏移 X', -12, 12, 0.05, 'µm', 2), mk('dy', '橫向偏移 Y', -12, 12, 0.05, 'µm', 2), mk('gap', '光纖到晶片端面的間距', 0, 120, 0.1, 'µm', 1)),
        h('div', null, mk('tx', '傾角（水平面）', -6, 6, 0.05, '°', 2, DEG), mk('ty', '傾角（垂直面）', -6, 6, 0.05, '°', 2, DEG),
          h('div', { class: 'small muted' }, '傾角繞「光纖端面中心」轉；端面上的光點中心會平移 間距×傾角。')),
        h('div', { class: 'kpi' }, h('div', { class: 'lab' }, '耦合效率（功率計讀數）'), bigEta, bigDb, meterCv)));
    const sideG = fitCanvas(sideCv, () => draw()), facetG = fitCanvas(facetCv, () => draw()), meterG = fitCanvas(meterCv, () => draw());
    V.s1 = { condBox, sideG, facetG, meterG, bigEta, bigDb, note };
    note.textContent = PRESETS[presetId].note + '（示意值，非實機規格）';
    setGapRange(); syncSliders();
    return { show() { active = 1; lp.start(); sideG.apply(); facetG.apply(); meterG.apply(); draw(); }, hide() { active = 0; lp.stop(); } };
  });

  // ===================== 投影片 2：端面反射造成的 FP 漣漪 =====================
  // 光纖尖端（玻璃 n≈1.45）與晶片端面各反射一點光，兩面之間成為低精細度的 Fabry–Pérot 腔：
  //   P(d) = η(d)·(1−R₁)(1−R₂) / (1 + R₁R₂γ² − 2√(R₁R₂)·γ·cos(2k₀d))，週期 λ/2。
  // γ：反射光來回 2d 後再耦合回光纖模場的振幅比例＝同一條高斯光束軸向錯開 2(d−WD) 的重疊，γ = 1/√(1+((d−WD)/z_R)²)。
  const FACETS = {
    ssc: { label: 'SSC 端面（氧化矽，n≈1.45）', n: 1.45 },
    si: { label: '矽端面（n≈3.48）', n: 3.48 },
    ar: { label: '鍍抗反射膜（假設 R≈0.1%）', R: 0.001 },
  };
  const Rof = (f) => f.R ?? ((f.n - 1) / (f.n + 1)) ** 2;
  const FP_SRC = '端面反射率用菲涅耳公式 R = ((n−1)/(n+1))²，多次反射的穿透率用 Fabry–Pérot 多光束干涉公式：E. Hecht, Optics, 5th ed., Pearson (2017), Ch. 4、Ch. 9。'
    + '折射率：矽 n ≈ 3.48（H. H. Li, J. Phys. Chem. Ref. Data 9(3), 561–658 (1980), doi:10.1063/1.555624）；氧化矽／光纖玻璃 n ≈ 1.44–1.45（I. H. Malitson, J. Opt. Soc. Am. 55(10), 1205–1209 (1965), doi:10.1364/JOSA.55.001205）。抗反射膜 R≈0.1% 為假設值（市售鍍膜端面約 0.1–1%）。'
    + '反射光再耦合回光纖的比例用高斯光束重疊計算，同 ① 的模型（Y. St-Amant et al., Appl. Opt. 43(30), 5691–5704 (2004), doi:10.1364/AO.43.005691）。'
    + '光纖陣列與晶片之間的 FP 腔使耦合效率隨次波長的間距變化起伏約零點幾 dB 的實測：S. N. Parise et al., arXiv:2506.08155 (2025)（預印本，尚未經同儕審查）。';
  sec.slide({ title: '端面反射：間距一變，功率就上下起伏（Fabry–Pérot 漣漪）', sub: '' }, (body) => {
    addStyle(body);
    body.closest('.slide').classList.add('edge-ui', 'reflection-ui');
    const st = { d: p.WD, facet: 'ssc' };
    const R1 = Rof({ n: 1.45 }), zR = beamAt(p, 0).zR;
    const fp = (d) => {
      const R2 = Rof(FACETS[st.facet]), g = 1 / Math.sqrt(1 + ((d - p.WD) / zR) ** 2), r = Math.sqrt(R1 * R2) * g;
      const e = eta(p, { dx: 0, dy: 0, gap: d, tx: 0, ty: 0 }), T = ((1 - R1) * (1 - R2)) / (1 + r * r - 2 * r * Math.cos(2 * K0 * d));
      return { e, P: e * T, env: e * (1 - R1) * (1 - R2), pp: 20 * Math.log10((1 + r) / (1 - r)), R2 };
    };
    const cv = h('canvas', { style: { width: '100%', height: '100%', display: 'block' } });
    const G = fitCanvas(cv, () => draw3());
    const seg = segmented(Object.entries(FACETS).map(([id, f]) => ({ id, label: f.label })), st.facet, (id) => { st.facet = id; draw3(); });
    seg.el.style.flexDirection = 'column';
    const sD = slider({ label: '間距 d（光纖尖端到晶片端面）', min: p.WD - 4, max: p.WD + 4, step: 0.01, value: st.d, unit: 'µm', digits: 2, onInput: (v) => { st.d = v; draw3(); } });
    const kP = h('div', { class: 'big', style: { fontSize: '34px' } }), kPP = h('div', { class: 'big', style: { fontSize: '34px', color: '#ffb86b' } });
    body.append(h('div', { class: 'grid grow', style: { gridTemplateColumns: '1.75fr 1fr' } },
      h('div', { class: 'card dark', style: { padding: '8px 10px' } }, cv),
      h('div', { class: 'card dark col', style: { gap: '10px', color: '#dfe8fa' } },
        h('div', null, h('div', { class: 'small muted' }, '晶片端面'), seg.el), sD.el,
        h('div', { class: 'grid g2', style: { gap: '10px' } },
          h('div', { class: 'kpi' }, h('div', { class: 'lab' }, '目前功率'), kP),
          h('div', { class: 'kpi' }, h('div', { class: 'lab' }, '漣漪峰對峰'), kPP)),
        h('ul', { style: { fontSize: '15.5px', lineHeight: 1.6, margin: '0', paddingLeft: '20px' } },
          h('li', null, '兩個端面各反射一點光，中間就像一個共振腔；間距每變 λ/2 ≈ 0.78 µm，功率起伏一次'),
          h('li', null, '起伏大小主要看兩面反射率：矽端面最大，鍍抗反射膜幾乎看不到；本頁假設反射光全部耦合回去，所以是上限，離光腰越遠起伏越小'),
          h('li', null, h('b', { style: { color: '#ffb86b' } }, '對 Z 對位的影響：'), '沿 Z 移動時功率疊上這個起伏，用功率比反推間距（B）會被帶偏；在同一個 Z 繞圈量光斑寬度（C）時，每一點間距相同，漣漪只是共同倍數，光斑寬度不受影響')))),
      h('div', { class: 'src', style: { flex: 'none' } }, FP_SRC));
    function draw3() {
      if (!G.w) return;
      const { ctx, w: W, h: H } = G; ctx.clearRect(0, 0, W, H);
      const cur = fp(st.d);
      kP.textContent = `${(10 * Math.log10(cur.P)).toFixed(2)} dB`; kPP.textContent = `${cur.pp.toFixed(2)} dB`;
      const font = (s, w = 400) => `${w} ${s}px system-ui, "Microsoft JhengHei", sans-serif`;
      // ---- 上：示意（光纖尖端 ↔ 晶片端面，來回反射）----
      const sh = Math.round(H * 0.34), fx = W * 0.3, cx2 = W * 0.7, my = sh * 0.55;
      ctx.fillStyle = 'rgba(160,190,240,.18)'; ctx.strokeStyle = 'rgba(190,215,255,.75)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(20, my - 44); ctx.lineTo(fx - 50, my - 44); ctx.lineTo(fx, my - 16); ctx.lineTo(fx, my + 16); ctx.lineTo(fx - 50, my + 44); ctx.lineTo(20, my + 44); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1f2a3d'; ctx.fillRect(cx2, my - 56, W - cx2 - 20, 112); ctx.strokeStyle = '#5d7aa6'; ctx.strokeRect(cx2, my - 56, W - cx2 - 20, 112);
      ctx.fillStyle = 'rgba(56,189,248,.35)'; ctx.fillRect(cx2, my - 6, W - cx2 - 20, 12);
      const arrow = (x0, x1, y, a) => { ctx.strokeStyle = `rgba(255,154,77,${a})`; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); const s = Math.sign(x1 - x0); ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x1 - 10 * s, y - 6); ctx.lineTo(x1 - 10 * s, y + 6); ctx.fill(); };
      const amp = Math.min(1, Math.sqrt(cur.R2) * 2.2 + 0.25);
      arrow(fx + 6, cx2 - 6, my - 22, 0.95); arrow(cx2 - 6, fx + 6, my, 0.45 * amp); arrow(fx + 6, cx2 - 6, my + 22, 0.25 * amp);
      arrow(cx2 + 4, W - 40, my - 22, 0.9);
      ctx.fillStyle = '#dfe8fa'; ctx.font = font(14, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(`光纖端面 R₁ = ${(R1 * 100).toFixed(1)}%`, fx - 20, 6); ctx.fillText(`晶片端面 R₂ = ${(cur.R2 * 100).toFixed(cur.R2 < 0.01 ? 1 : 1)}%`, cx2 + 60, 6);
      ctx.fillStyle = '#ffd29a'; ctx.fillText(`間距 d = ${st.d.toFixed(2)} µm`, (fx + cx2) / 2, my + 40);
      ctx.fillStyle = '#93a6c6'; ctx.font = font(13); ctx.fillText('來回反射的光和直接進去的光疊加：相位對上就變亮，錯開就變暗', (fx + cx2) / 2, sh - 4);
      // ---- 下：功率 vs 間距 ----
      const L = 64, T = sh + 30, Wp = W - L - 20, Hp = H - T - 42, d0 = p.WD - 4, d1 = p.WD + 4;
      const xs = [], ys = [], es = []; for (let i = 0; i <= 1600; i++) { const d = d0 + ((d1 - d0) * i) / 1600, q = fp(d); xs.push(d); ys.push(10 * Math.log10(q.P)); es.push(10 * Math.log10(q.env)); }
      const yMax = Math.max(...ys) + 0.3, yMin = Math.min(...ys) - 0.3;
      const X = (d) => L + ((d - d0) / (d1 - d0)) * Wp, Y = (v) => T + (1 - (v - yMin) / (yMax - yMin)) * Hp;
      ctx.fillStyle = '#081120'; ctx.fillRect(L, T, Wp, Hp); ctx.strokeStyle = 'rgba(140,170,230,.35)'; ctx.lineWidth = 1; ctx.strokeRect(L, T, Wp, Hp);
      ctx.strokeStyle = 'rgba(140,170,230,.12)'; ctx.fillStyle = '#93a6c6'; ctx.font = font(12); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let d = Math.ceil(d0); d <= d1; d++) { ctx.beginPath(); ctx.moveTo(X(d), T); ctx.lineTo(X(d), T + Hp); ctx.stroke(); ctx.fillText(`${d}`, X(d), T + Hp + 5); }
      ctx.fillText('間距 d（µm）', L + Wp / 2, T + Hp + 22);
      const yst = (yMax - yMin) > 3 ? 1 : 0.5; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let v = Math.ceil(yMin / yst) * yst; v <= yMax; v += yst) { ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(L + Wp, Y(v)); ctx.stroke(); ctx.fillText(v.toFixed(1), L - 6, Y(v)); }
      ctx.save(); ctx.translate(16, T + Hp / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText('耦合功率（dB）', 0, 0); ctx.restore();
      const line = (arr, col, wd, dash) => { ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.setLineDash(dash || []); ctx.beginPath(); arr.forEach((v, i) => (i ? ctx.lineTo(X(xs[i]), Y(v)) : ctx.moveTo(X(xs[i]), Y(v)))); ctx.stroke(); ctx.setLineDash([]); };
      line(es, 'rgba(127,178,255,.85)', 2, [6, 5]); line(ys, '#ff9a4d', 2.2);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(st.d), T); ctx.lineTo(X(st.d), T + Hp); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X(st.d), Y(10 * Math.log10(cur.P)), 5, 0, 7); ctx.fill();
      // 週期標記
      const pd = LAMBDA / 2, ya = T + 16; ctx.strokeStyle = '#ffd29a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(d0 + 0.5), ya); ctx.lineTo(X(d0 + 0.5 + pd), ya); ctx.stroke();
      ctx.fillStyle = '#ffd29a'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = font(13, 600); ctx.fillText(`週期 λ/2 = ${pd.toFixed(3)} µm`, X(d0 + 0.5 + pd) + 8, ya);
      ctx.textAlign = 'right'; ctx.fillStyle = '#ff9a4d'; ctx.fillText('有端面反射（量到的功率）', L + Wp - 10, T + 16); ctx.fillStyle = '#7fb2ff'; ctx.fillText('沒有反射（只有模場耦合）', L + Wp - 10, T + 34);
    }
    return { show() { G.apply(); draw3(); } };
  });

  // ---- 繪製 ----
  function draw() {
    const e = eta(p, pose);
    const cx = pose.dx + pose.gap * pose.tx, cy = pose.dy + pose.gap * pose.ty;
    const spot = beamAt(p, pose.gap - p.WD).w;
    const target = clamp(Math.max(3 * Math.max(p.wgx, p.wgy), 1.8 * spot, 1.5 * Math.hypot(cx, cy)), 3, 90);
    if (active === 1) hw += (target - hw) * 0.18;
    if (active === 1 && V.s1 && V.s1.sideG.w) {
      const { condBox, sideG, facetG, meterG, bigEta, bigDb } = V.s1;
      drawSide(sideG, p, pose, { ...zoomView(), eta: e });
      drawFacet(facetG, p, pose, { hw, trail });
      const lat = Math.hypot(cx, cy), zErr = Math.abs(pose.gap - p.WD), th = Math.hypot(pose.tx, pose.ty), tolLat = Math.min(tol.x, tol.y);
      const item = (title, val, tolTxt, ok) => h('div', { class: ok ? 'ok' : 'bad' },
        h('span', { class: 'st' }, ok ? '✔ 在容差內' : '✖ 超出'), h('b', null, title), h('div', { class: 'v' }, `${val}　（${tolTxt}）`));
      condBox.replaceChildren(
        item('① 位置', `偏離 ${fmtLen(lat)}`, `容差 ±${fmtLen(tolLat)}`, lat <= tolLat),
        item('② 焦平面（Z）', `離端面 ${fmtLen(zErr)}`, `容差 ±${fmtLen(tol.z)}`, zErr <= tol.z),
        item('③ 方向（傾角）', `${(th / DEG).toFixed(2)}°`, `容差 ±${(tol.t / DEG).toFixed(2)}°`, th <= tol.t),
        h('div', null, h('b', null, '④ 大小匹配'), h('div', { class: 'v' }, `失配 ${fmtDb(lossDb(eta(p, { dx: 0, dy: 0, gap: p.WD, tx: 0, ty: 0 })))}`), h('div', { class: 'small muted' }, '由光纖與波導模場決定')));
      bigEta.textContent = fmtPct(e); bigDb.textContent = `${fmtDb(lossDb(e))} 損耗`;
      drawMeter(meterG, toDb(e));
    }
  }

  const lp = loop(() => draw());
}
