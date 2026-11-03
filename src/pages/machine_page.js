// 分頁 ⑤ 對位平台（3+3+6：XYZ 粗動＋角度粗動＋6 軸奈米壓電）：
//   1 機台導覽（報價網頁的 3D 機台）  2 三段式對位動畫（機台＋12 軸讀值＋相機照片＋進度報告的精對位）
//   3 微觀特寫（光纖尖端與 PIC 端面，真實比例）  4 陣列光纖對 PIC 實機動畫  5 統整
// 時間軸在 ../mscenario.js；3D 機台靠 postMessage 控制（../platform.js、build.mjs 的 EMBED_API）。
import { h, segmented, fitCanvas, drawPlot, fmtLen, clamp, DEG } from '../ui.js';
import { Platform } from '../platform.js';
import { Micro3D } from '../micro3d.js';
import { Vector3 } from 'three';
import { createTransport } from '../scenario.js';
import { ZT } from '../zanim.js';
import { drawCamPhoto } from '../camphoto.js';
import { buildMachineRun, buildFARun, AXES, GROUPS, SCOL } from '../mscenario.js';

const CSS = `
.m3d { position:relative; border-radius:12px; overflow:hidden; background:#15171a; }
.hud { position:absolute; left:12px; bottom:12px; background:rgba(10,16,30,.85); color:#e6eefc; border:1px solid rgba(140,170,220,.35); border-radius:10px; padding:8px 14px; font-size:15px; max-width:70%; pointer-events:none; z-index:2; backdrop-filter:blur(6px); }
.hud b { color:#ffb86b; } .hud .mono { font-size:13.5px; color:#b9c8e2; }
.vbtn { position:absolute; right:12px; top:12px; z-index:3; }
.vbtn.seg { background:rgba(10,16,30,.7); border-color:rgba(140,170,220,.5); backdrop-filter:blur(6px); }
.vbtn.seg button { background:transparent; color:#cfe0ff; border-right-color:rgba(140,170,220,.3); }
.vbtn.seg button.on { background:#ffb86b; color:#1a1206; }
.stg { position:absolute; left:12px; top:12px; z-index:3; display:flex; gap:6px; pointer-events:none; }
.stg span { padding:6px 14px; border-radius:99px; font-size:15px; font-weight:700; color:#9fb3d1; background:rgba(10,16,30,.7); border:1px solid rgba(140,170,220,.3); transition:.3s; }
.stg span.on { color:#fff; transform:scale(1.08); box-shadow:0 0 18px currentColor; }
.stg span.done { color:#cfe0ff; opacity:.75; }
.mag { position:absolute; right:12px; bottom:12px; z-index:2; font-size:12.5px; color:#cfe0ff; background:rgba(10,16,30,.7); padding:3px 10px; border-radius:99px; pointer-events:none; }
.pctl { display:flex; flex-direction:column; gap:10px; }
.pctl .stp { display:flex; gap:12px; align-items:flex-start; border:1px solid var(--line); border-radius:12px; padding:10px 12px; cursor:pointer; background:#fff; transition:.15s; }
.pctl .stp:hover { border-color:var(--accent2); transform:translateY(-1px); box-shadow:0 6px 16px rgba(20,40,80,.12); }
.pctl .stp.on { border-color:var(--beam); box-shadow:0 0 0 2px rgba(232,89,12,.25); }
.pctl .stp .n { flex:none; width:34px; height:34px; border-radius:50%; color:#fff; font-weight:700; display:flex; align-items:center; justify-content:center; font-size:15px; }
.pctl .stp b { font-size:16.5px; } .pctl .stp div div { font-size:14px; color:var(--muted); line-height:1.45; }
.pctl .role { display:inline-block; font-size:12.5px; font-weight:700; color:#fff; padding:1px 8px; border-radius:99px; margin-left:6px; vertical-align:2px; }
.m336 { display:flex; gap:6px; align-items:center; font-size:15px; font-weight:700; }
.m336 span { padding:4px 12px; border-radius:99px; color:#fff; }
.mban { font-size:18px; font-weight:700; color:#fff; padding:8px 12px; border-radius:10px; border-left:6px solid; background:rgba(255,255,255,.05); min-height:24px; }
.mchips { display:flex; gap:5px; flex-wrap:wrap; } .mchips span { font-size:13px; padding:3px 9px; border-radius:99px; color:#9fb3d1; border:1px solid rgba(140,170,220,.3); }
.mchips span.on { color:#fff; font-weight:700; } .mchips span.done { color:#cfe0ff; opacity:.6; }
.mdyn { position:relative; flex:1; min-height:0; }
.mdyn > div { position:absolute; inset:0; display:none; } .mdyn > div.on { display:flex; flex-direction:column; gap:6px; }
.mph { display:grid; grid-template-columns:1fr 1fr; gap:8px; flex:1; min-height:0; } .mph canvas { width:100%; height:100%; display:block; border-radius:8px; }
.mml { font-size:13.5px; color:#cfe0ff; font-family:var(--mono); } .mml b { color:#5fd4ff; }
.mstack { display:flex; flex-direction:column; gap:3px; flex:1; justify-content:center; }
.mstack div { display:flex; justify-content:space-between; align-items:center; padding:4px 12px; border-radius:7px; font-size:14.5px; color:#9fb3d1; background:rgba(255,255,255,.04); border:1px solid rgba(140,170,220,.18); transition:.2s; }
.mstack div b { font-size:13px; font-weight:600; opacity:.8; }
.mstack div.on { color:#fff; transform:scaleX(1.03); box-shadow:0 0 16px var(--c); border-color:var(--c); background:color-mix(in srgb, var(--c) 30%, transparent); }
.dro { display:grid; grid-template-columns:1fr 1fr 1.25fr; gap:8px; flex:none; }
.dro .gp { border:1px solid rgba(140,170,220,.22); border-radius:10px; padding:5px 8px; }
.dro .gp h4 { margin:0 0 3px; font-size:12.5px; font-weight:700; }
.dro .r { display:flex; justify-content:space-between; font-size:13px; color:#93a6c6; padding:1px 4px; border-radius:5px; transition:background .25s; }
.dro .r span:last-child { font-family:var(--mono); color:#dfe8fa; }
.dro .r.on { background:var(--c); color:#fff; } .dro .r.on span:last-child { color:#fff; font-weight:700; }
.dro .two { display:grid; grid-template-columns:1fr 1fr; column-gap:6px; }
.msrc { font-size:12px; color:var(--stage-muted); line-height:1.45; flex:none; }
.mov { position:absolute; inset:0; pointer-events:none; }
.mread { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.mread > div { background:rgba(255,255,255,.05); border:1px solid rgba(140,170,230,.25); border-radius:10px; padding:6px 10px; }
.mread b { display:block; font-family:var(--mono); font-size:22px; color:#ffb86b; } .mread span { font-size:13px; color:#93a6c6; }
.mx td, .mx th { padding:4px 9px; font-size:14px; } .mx .c1 { background:#e4edf9; } .mx .c2 { background:#efe7fb; } .mx .c3 { background:#fde8d8; font-weight:600; } .mx .c0 { color:#8b95a7; }
.mx .gh td { background:#f3f5f9; font-weight:700; font-size:13px; color:#41506a; }
`;
let cssDone = false;
const addCss = (body) => { if (!cssDone) { body.append(h('style', null, CSS)); cssDone = true; } };
const hex = (c) => parseInt(c.slice(1), 16);
const fmtAx = (v, u) => u === 'rad' ? `${(v / DEG).toFixed(3)}°` : Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(3)} mm` : `${v.toFixed(2)} µm`;
const GCOL = ['#3b6ea8', '#2f9e6b', '#e8590c'];
const qualityControl = (change) => segmented([{ id: 'auto', label: '自動畫質' }, { id: 'high', label: '高清' }, { id: 'fast', label: '流暢' }], 'auto', change);
function transportPanel(tr) {
  tr.el.classList.add('machine-transport');
  tr.el.querySelector('input[type=range]').setAttribute('aria-label', '對位動畫時間軸');
  return tr.el;
}
const evidence = (text = '運動與光功率為模擬示意，尚未真機驗證') => h('div', { class: 'machine-evidence' }, h('span', null, 'SIMULATION'), text);

// 3D 機台的鏡頭位置（mm；光纖尖端在 (−0.5, 362, 0)，光軸＝+x）
const FY = 362;
const CAMS = {
  angle: { p: [-170, FY + 90, 250], t: [-25, FY - 70, 0] },
  approach: { p: [-150, FY + 70, 190], t: [-25, FY - 10, 0] },
  tip: { p: [-9, FY + 7, 5], t: [-1.5, FY, 0] },
  couple: { p: [-11, FY + 12, 44], t: [-11, FY - 1, 0] },
  faTop: { p: [-3, FY + 14, 20], t: [-4, FY, 0] },          // 陣列：斜前方看 FA 玻璃塊與晶片上的 8 條波導   // 側面看：光纖頭（壓電放大後在晶片前約 20 mm）到晶片端面
};
function camTo(plat, k) { if (CAMS[k]) plat.send('cam', CAMS[k]); else plat.view(k); }

// ---- 12 軸讀值（數值有變就亮）----
function buildDRO(axes = AXES) {
  const rows = axes.map((a) => { const v = h('span'); const el = h('div', { class: 'r', style: { '--c': GCOL[a.g] } }, h('span', null, a.name), v); return { a, el, v, last: null, on: 0 }; });
  const gp = (g, two) => h('div', { class: 'gp' }, h('h4', { style: { color: GCOL[g] } }, GROUPS[g]),
    h('div', { class: two ? 'two' : '' }, rows.filter((r) => r.a.g === g).map((r) => r.el)));
  const el = h('div', { class: 'dro' }, gp(0), gp(1), gp(2, true));
  return {
    el, rows,
    update(s) {
      const now = performance.now();
      for (const r of rows) {
        const x = r.a.get(s);
        if (r.last !== null && Math.abs(x - r.last) > (r.a.u === 'rad' ? 2e-8 : 2e-4)) r.on = now;
        r.last = x; r.v.textContent = fmtAx(x, r.a.u);
        r.el.classList.toggle('on', now - r.on < 260);
      }
      return rows.map((r) => now - r.on < 260);
    },
  };
}
// ---- 機台堆疊示意（由上而下；亮的那層＝正在動）----
const LAYERS = [
  { name: '光纖夾具頭', ax: [], g: 2 }, { name: '6 軸奈米壓電', ax: [6, 7, 8, 9, 10, 11], g: 2, p: 'R3' },
  { name: 'θx 俯仰（測角台上層）', ax: [3], g: 1, p: 'R5' }, { name: 'θz 滾轉（測角台下層）', ax: [5], g: 1, p: 'R5' },
  { name: 'θy 偏擺（旋轉台）', ax: [4], g: 1, p: 'R6' }, { name: 'Y 垂直（垂直滑台）', ax: [1], g: 0, p: 'R2' },
  { name: 'X 橫向（滑台）', ax: [0], g: 0, p: 'R1' }, { name: 'Z 間距（滑台，最底層）', ax: [2], g: 0, p: 'R1' },
];
function buildStack() {
  const els = LAYERS.map((l) => h('div', { style: { '--c': GCOL[l.g] } }, h('span', null, l.name), h('b', null, l.p ? `報價編號 ${l.p.replace('R', '')}` : '')));
  return { el: h('div', { class: 'mstack' }, h('div', { style: { justifyContent: 'center', border: 0, background: 'none', color: '#cfe0ff', fontSize: '13px' } }, '移動側由上而下的堆疊（亮的那層正在動）'), ...els),
    update(act) { LAYERS.forEach((l, i) => els[i].classList.toggle('on', l.ax.some((k) => act[k]))); } };
}
// ---- 3D 機台外框（階段標籤、運鏡切換、HUD）----
function machineFrame(stages, ampNote) {
  const holder = h('div', { class: 'm3d machine-viewport', style: { height: '100%' } });
  const hud = h('div', { class: 'hud' });
  const stg = h('div', { class: 'stg' }, stages.map((g, i) => h('span', null, `${i + 1}　${g.short}`)));
  let autoCam = true, onAuto = null;
  const seg = segmented([{ id: 'auto', label: '自動運鏡' }, { id: 'board', label: '主機近景' }, { id: 'all', label: '全景' }, { id: 'stack', label: '移動側' }, { id: 'couple', label: '耦合區' }], 'auto', (id) => {
    autoCam = id === 'auto'; if (autoCam) onAuto && onAuto(); else camTo(plat, id === 'couple' ? 'couple' : id);
  });
  seg.el.classList.add('machine-views');
  const quality = qualityControl(v => plat.send('quality', { v }));
  holder.append(hud, h('div', { class: 'machine-toolbar' }, seg.el, quality.el), stg, h('div', { class: 'mag' }, ampNote));
  const plat = new Platform(holder, { tour: true });
  plat.send('pins', { on: false }); plat.send('axes', { on: false });
  const setStage = (n) => [...stg.children].forEach((el, i) => { el.className = i + 1 === n ? 'on' : i + 1 < n ? 'done' : ''; el.style.background = i + 1 === n ? stages[i].color : ''; });
  return { holder, hud, plat, setStage, get autoCam() { return autoCam; }, set onAuto(f) { onAuto = f; } };
}

// ===================== 1. 機台導覽 =====================
export function platformTour(body) {
  addCss(body);
  const holder = h('div', { class: 'm3d tour-viewport', style: { height: '100%' } });
  const plat = new Platform(holder, { tour: true });
  let cur = null;
  const role = (txt, c) => h('span', { class: 'role', style: { background: c } }, txt);
  const steps = [
    { id: 'all', n: '◎', col: '#5b6678', t: '設備總覽', r: null, d: '移動側光纖、PIC 晶片與固定側收光光纖，整合在隔振光學平台。拖曳檢視機構；切換「完整配置」可看後方量測儀器。', run: () => { plat.send('stop'); plat.stage(0); plat.view('board'); } },
    { id: 's1', n: '3', col: GCOL[0], t: '粗動 XYZ', r: ['粗動 3 軸', GCOL[0]], d: '兩支駿河 KXL06050M 電動滑台（Z 控制間距、X 橫向，行程 50 mm）＋駿河 KZL06075M 垂直滑台（Y，行程 75 mm）。毫米級大行程，把透鏡光纖送到晶片前、進相機視野，之後鎖住。', run: () => { plat.send('stop'); plat.stage(1); plat.view('stack'); } },
    { id: 's2', n: '3', col: GCOL[1], t: '角度粗動 θx θy θz', r: ['角度 3 軸', GCOL[1]], d: '旋轉台（θy）＋一台雙軸測角台（下層 θz、上層 θx）。測角台兩軸共用台面上方 75 mm 的旋轉中心，旋轉台的軸也穿過這一點；光纖尖端裝在這一點，轉角度時尖端幾乎不動（紅點不動）。', run: () => { plat.stage(0); plat.send('ang'); } },
    { id: 's3', n: '6', col: GCOL[2], t: '6 軸奈米壓電', r: ['精對位 6 軸', GCOL[2]], d: 'XYZ＋三個角度（型號待定，旋轉中心同樣要落在光纖端面）。靠光功率回饋：螺旋找光、繞圈梯度、量間距、靠近、最後微調角度（位移放大 1000 倍顯示）。', run: () => { plat.stage(3); plat.send('demo'); } },
    { id: 'cp', n: '⌖', col: '#7048c9', t: '上視＋側視相機', r: ['階段 2 用', '#7048c9'], d: '兩台相機看透鏡光纖與晶片端面，ML 估出 X、Y、間距、傾角，讓粗動與角度台修正到 XY ±40 µm、間距 ±50 µm 內。', run: () => { plat.send('stop'); plat.stage(2); plat.view('couple'); } },
  ];
  const els = steps.map((s) => {
    const el = h('div', { class: 'stp', role: 'button', tabindex: '0', 'aria-pressed': 'false', onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(s.id); } }, onclick: () => go(s.id) },
      h('span', { class: 'n', style: { background: s.col } }, s.n), h('div', null, h('b', null, s.t, s.r ? role(...s.r) : null), h('div', null, s.d)));
    s.el = el; return el;
  });
  function go(id) {
    cur = id;
    holder.classList.toggle('tour-running', id === 's2' || id === 's3');
    for (const s of steps) { s.el.classList.toggle('on', s.id === id); s.el.setAttribute('aria-pressed', String(s.id === id)); }
    steps.find((s) => s.id === id).run();
    views.set({ all: 'board', s1: 'stack', s2: 'stack', s3: 'couple', cp: 'couple' }[id], true);
    if (id !== 's2') plat.send('axes', { on: false });
  }
  const views = segmented([
    { id: 'board', label: '主機近景' }, { id: 'all', label: '完整配置' },
    { id: 'stack', label: '堆疊機構' }, { id: 'couple', label: '耦合特寫' }, { id: 'inst', label: '量測儀器' },
  ], 'board', id => { holder.classList.remove('tour-running'); plat.send('stop'); plat.stage(0); plat.send('axes', { on: false }); plat.view(id); });
  views.el.classList.add('tour-views');
  const quality = segmented([{ id: 'auto', label: '自動畫質' }, { id: 'high', label: '高清' }, { id: 'fast', label: '流暢' }], 'auto', v => plat.send('quality', { v }));
  quality.el.classList.add('tour-quality');
  holder.append(h('div', { class: 'tour-topbar' },
    h('div', { class: 'tour-caption' }, h('span', { class: 'tour-dot' }), '3D 設備預覽'), quality.el),
    h('div', { class: 'tour-viewbar' }, views.el),
    h('div', { class: 'tour-note' }, '配置示意 · 尚未真機驗證'));
  let aside = false;
  const asideBtn = h('button', { class: 'btn ghost', type: 'button', 'aria-expanded': 'false', onclick: () => { aside = !aside; holder.classList.toggle('tour-aside', aside); plat.send('aside', { on: aside }); asideBtn.setAttribute('aria-expanded', String(aside)); asideBtn.textContent = aside ? '收起元件清單' : '元件清單與報價'; } }, '元件清單與報價');
  let pins = false;
  plat.send('pins', { on: false }); plat.send('axes', { on: false });
  const pinBtn = h('button', { class: 'btn ghost', type: 'button', 'aria-pressed': 'false', onclick: () => { pins = !pins; plat.send('pins', { on: pins }); pinBtn.setAttribute('aria-pressed', String(pins)); pinBtn.textContent = pins ? '隱藏元件編號' : '顯示元件編號'; } }, '顯示元件編號');
  let teaching = false;
  const teachingBtn = h('button', { class: 'btn ghost', type: 'button', 'aria-pressed': 'false', onclick: () => { teaching = !teaching; plat.send('teaching', { on: teaching }); teachingBtn.setAttribute('aria-pressed', String(teaching)); teachingBtn.textContent = teaching ? '恢復寫實材質' : '加強教學高亮'; } }, '加強教學高亮');
  body.append(h('div', { class: 'grid fill tour-layout', style: { gridTemplateColumns: '340px 1fr' } },
    h('div', { class: 'card col pctl' },
      h('div', { class: 'tour-panel-title' }, h('span', null, 'ALIGNMENT PLATFORM'), h('h2', null, '精密對位平台'), h('p', null, '選擇機構，檢視運動與細節')),
      h('div', { class: 'm336' }, h('span', { style: { background: GCOL[0] } }, '3 粗動'), '＋', h('span', { style: { background: GCOL[1] } }, '3 角度'), '＋', h('span', { style: { background: GCOL[2] } }, '6 壓電')),
      ...els,
      h('div', { class: 'row', style: { marginTop: 'auto', flexWrap: 'wrap' } }, asideBtn, pinBtn, teachingBtn)),
    h('div', { class: 'card tour-scene', style: { padding: '0', background: '#0d1424' } }, holder)));
  return { show() { go(cur || 'all'); }, hide() { plat.send('stop'); } };
}

// ===================== 2. 三段式對位動畫 =====================
export function buildMachineSlide(body) {
  addCss(body);
  const R = buildMachineRun();
  const F = machineFrame(R.stages, `階段 3：壓電位移放大 ${R.AMP} 倍、角度放大 10 倍顯示；階段 1、2 為真實尺寸`);
  const ban = h('div', { class: 'mban' });
  const chips = h('div', { class: 'mchips' }, R.steps3.map((s) => h('span', null, s.name)));
  const stack = buildStack();
  const topCv = h('canvas'), sideCv = h('canvas'), zCv = h('canvas', { style: { width: '100%', height: '100%', display: 'block', borderRadius: '8px' } });
  const mlTxt = h('div', { class: 'mml' });
  const pane = [h('div', null, stack.el), h('div', null, h('div', { class: 'mph' }, topCv, sideCv), mlTxt), h('div', null, zCv)];
  const dyn = h('div', { class: 'mdyn' }, ...pane);
  const dro = buildDRO();
  const right = h('div', { class: 'card dark col machine-inspector', style: { padding: '10px 12px', gap: '8px' } }, evidence(), ban, chips, dyn, dro.el);
  body.append(h('div', { class: 'grid fill machine-layout', style: { gridTemplateColumns: '1.3fr 1fr' } },
    h('div', { class: 'card', style: { padding: '6px', background: '#0d1424' } }, F.holder), right));
  const topG = fitCanvas(topCv), sideG = fitCanvas(sideCv), zG = fitCanvas(zCv);
  const tr = createTransport(R, (t) => frame(t), { idle: true });
  body.append(transportPanel(tr));
  let lastKey = '', lastCam = '', lastStage = 0, lastPane = -1;
  F.onAuto = () => { lastCam = ''; tr.redraw(); };
  function frame(t) {
    const s = R.at(t), st = R.stages[s.stage - 1];
    F.plat.send('pose', { p: R.machinePose(s) });
    const key = s.stage + '|' + s.part.join();
    if (key !== lastKey) { lastKey = key; F.plat.send('hl', { ids: s.part, color: hex(st.color) }); }
    if (s.stage !== lastStage) { lastStage = s.stage; F.setStage(s.stage); F.plat.send('hide', { ids: ['R18', 'R19'], on: s.stage === 3 }); }   // 精對位時藏起相機，才看得到光纖頭
    if (F.autoCam && s.cam !== lastCam) { lastCam = s.cam; camTo(F.plat, s.cam); }
    ban.textContent = s.step; ban.style.borderColor = st.color;
    [...chips.children].forEach((el, i) => { el.className = s.stage < 3 || s.s3 < i ? '' : s.s3 === i ? 'on' : 'done'; el.style.background = s.stage === 3 && s.s3 === i ? R.steps3[i].color : ''; });
    chips.style.visibility = s.stage === 3 ? 'visible' : 'hidden';
    const pi = s.stage - 1;
    if (pi !== lastPane) { lastPane = pi; pane.forEach((p, i) => p.classList.toggle('on', i === pi)); topG.apply(); sideG.apply(); zG.apply(); }
    const act = dro.update(s); stack.update(act);
    const r = s.rel, lit = s.lit;
    F.hud.innerHTML = `<b>${st.name}</b><div class="mono">離目標：X ${fmtLen(r.dx)}　Y ${fmtLen(r.dy)}　間距 ${fmtLen(r.gap)}　傾角 ${s.tiltDeg.toFixed(2)}°<br>${lit ? `功率 ${s.db.toFixed(1)} dB` : '功率計：還沒有光'}</div>`;
    if (s.stage === 2) {
      const shotT = R.t1 + s.shot * 3.4, flash = clamp(1 - (t - shotT) / 0.35, 0, 1);
      const m = s.ml, a = m.pose;
      drawCamPhoto(topG, { view: 'top', pose: r, fov: 1400, flash: flash * .12, ml: { u: -m.gap, v: m.dx, label: `ML：X ${m.dx.toFixed(0)} µm、間距 ${m.gap.toFixed(0)} µm` }, title: `上視相機（示意，第 ${s.shot + 1} 張）` });
      drawCamPhoto(sideG, { view: 'side', pose: r, fov: 1400, flash: flash * .12, ml: { u: -m.gap, v: m.dy, label: `ML：Y ${m.dy.toFixed(0)} µm、間距 ${m.gap.toFixed(0)} µm` }, title: `側視相機（示意，第 ${s.shot + 1} 張）` });
      mlTxt.innerHTML = `<b>ML 估計（示意值）</b>　X ${m.dx.toFixed(0)}　Y ${m.dy.toFixed(0)}　間距 ${m.gap.toFixed(0)} µm　傾角 ${m.tilt.toFixed(2)}°<br>實際　　 X ${a.dx.toFixed(0)}　Y ${a.dy.toFixed(0)}　間距 ${a.gap.toFixed(0)} µm　傾角 ${(Math.hypot(a.tx, a.ty) / DEG).toFixed(2)}°　（虛線十字＝ML 認為的尖端位置）`;
    }
    if (s.stage === 3 && zG.w) drawTelemetry(zG, s);
  }
  const history = Array.from({ length: 401 }, (_, i) => R.at(R.stages[2].t0 + i / 400 * (R.total - R.stages[2].t0)));
  function drawTelemetry(g, s) {
    const {ctx:c, w, h:H} = g, L = 48, T = 42, size = Math.min(H - 150, w * .53), R0 = L + size + 28;
    if (size < 30) return;
    c.clearRect(0, 0, w, H); c.fillStyle = '#102235'; c.fillRect(0, 0, w, H);
    const text = (value, x, y, color='#b6cbdc', font=12, align='left') => { c.font = font+'px system-ui'; c.fillStyle=color; c.textAlign=align; c.textBaseline='middle'; c.fillText(value,x,y); };
    const X = x => L + (x + 62) / 124 * size, Y = y => T + (62 - y) / 124 * size;
    text('XY 尋峰軌跡', L, 19, '#e2ebf4', 15);
    for (const v of [-60,-30,0,30,60]) {
      c.strokeStyle=v===0?'#617c93':'#2c4358'; c.lineWidth=1; c.beginPath(); c.moveTo(X(v),T); c.lineTo(X(v),T+size); c.moveTo(L,Y(v)); c.lineTo(L+size,Y(v)); c.stroke();
      text(v,L-8,Y(v),'#8da7bd',10,'right'); text(v,X(v),T+size+14,'#8da7bd',10,'center');
    }
    c.save(); c.beginPath(); c.rect(L,T,size,size); c.clip(); c.strokeStyle='#829eb8'; c.lineWidth=1.4; c.beginPath();
    let started=false;
    for (const state of history) { if(state.t>s.t)break; const r=state.rel; if(!started){c.moveTo(X(r.dx),Y(r.dy));started=true;} else c.lineTo(X(r.dx),Y(r.dy)); }
    c.stroke(); c.strokeStyle='#81c8b2'; c.lineWidth=1.5; c.beginPath(); c.arc(X(0),Y(0),6,0,Math.PI*2); c.stroke();
    c.fillStyle='#f0c48d'; c.beginPath(); c.arc(X(s.rel.dx),Y(s.rel.dy),4,0,Math.PI*2); c.fill(); c.restore();
    text('X 橫向 / Y 垂直 · µm', L+size/2,T+size+34,'#b6cbdc',11,'center');
    text('Z 端面間距',R0,19,'#e2ebf4',15);
    text(fmtLen(s.rel.gap),R0,53,'#f0c48d',25);
    text('XY 核心偏差',R0,96,'#9cb5c9',12); text(fmtLen(Math.hypot(s.rel.dx,s.rel.dy)),R0,122,'#d6e6f3',21);
    text('傾角',R0,162,'#9cb5c9',12); text(s.tiltDeg.toFixed(3)+'°',R0,187,'#d6e6f3',21);
    const y=H-24, x=48, barW=w-68, power=s.db===null?0:clamp((s.db+50)/50,0,1);
    text('耦合功率',x,y-19,'#b6cbdc',12); text(s.db===null?'尚未找到光':s.db.toFixed(1)+' dB',w-20,y-19,'#f0c48d',14,'right');
    c.fillStyle='#293f53'; c.fillRect(x,y,barW,7); c.fillStyle='#e2b985'; c.fillRect(x,y,barW*power,7);
    text('−50 dB',x,y+16,'#809bb2',10); text('0 dB',w-20,y+16,'#809bb2',10,'right');
  }
  frame(0);
  return {
    show() { tr.loop.start(); tr.redraw(); lastKey = lastCam = ''; lastStage = 0; lastPane = -1; topG.apply(); sideG.apply(); zG.apply(); },
    hide() { tr.loop.stop(); tr.pause(); },
  };
}

// ===================== 3. 化身光纖：一路對上 PIC，把光送進去 =====================
export function microSlide(body) {
  addCss(body);
  body.append(h('style', null, `
.fv { position:relative; height:100%; border-radius:12px; overflow:hidden; background:#03060d; }
.fv .ov { position:absolute; inset:0; pointer-events:none; }
.fv .tl { position:absolute; left:14px; top:12px; z-index:3; display:flex; flex-direction:column; gap:6px; max-width:62%; pointer-events:none; }
.fv .tl .st { align-self:flex-start; font-size:14px; font-weight:700; color:#fff; padding:4px 12px; border-radius:99px; }
.fv .tl .sp { font-size:21px; font-weight:700; color:#fff; text-shadow:0 2px 10px #000; }
.fv .tr { position:absolute; right:14px; top:12px; z-index:3; }
.fv .bt { position:absolute; left:14px; right:14px; bottom:12px; z-index:3; display:grid; grid-template-columns:repeat(3,1fr) 1.6fr; gap:10px; pointer-events:none; }
.fv .bt > div { background:rgba(8,14,28,.8); border:1px solid rgba(140,170,230,.3); border-radius:10px; padding:6px 12px; backdrop-filter:blur(6px); }
.fv .bt b { display:block; font-family:var(--mono); font-size:22px; color:#ffb86b; } .fv .bt span { font-size:13px; color:#93a6c6; }
.fv .pm { height:14px; border-radius:7px; background:rgba(255,255,255,.08); overflow:hidden; margin-top:6px; } .fv .pm i { display:block; height:100%; background:linear-gradient(90deg,#c2410c,#ffb86b); transition:width .15s; }
.fv .big { position:absolute; left:50%; top:9%; transform:translateX(-50%); z-index:3; font-size:30px; font-weight:800; color:#1a1206; background:rgba(255,184,107,.95); padding:10px 28px; border-radius:99px; box-shadow:0 0 40px rgba(255,160,60,.6); opacity:0; transition:opacity .4s; pointer-events:none; white-space:nowrap; }
`));
  const R = buildMachineRun(), FIN = 7;
  const stages = [...R.stages, { id: 4, name: '光送進 PIC', short: '光進入 PIC', color: '#ffb020', t0: R.total, t1: R.total + FIN }];
  const sc = { total: R.total + FIN, stages };
  const hold = h('div', { class: 'fv' }), ov = h('canvas', { class: 'ov' });
  const stTag = h('span', { class: 'st' }), stepEl = h('div', { class: 'sp' });
  let mode = 'chase';
  const seg = segmented([{ id: 'chase', label: '化身光纖' }, { id: 'orbit', label: '旁觀（可拖曳）' }], 'chase', (id) => { mode = id; tr.redraw(); });
  seg.el.style.whiteSpace = 'nowrap';
  const rd = { gap: h('b'), lat: h('b'), tilt: h('b'), pw: h('b') }, pmBar = h('i');
  const big = h('div', { class: 'big' }, '對準了！光從光纖送進 PIC 的波導');
  const quality = qualityControl(v => M.setQuality(v));
  hold.append(ov, h('div', { class: 'tl' }, stTag, stepEl), h('div', { class: 'tr' }, seg.el, quality.el), big,
    h('div', { class: 'micro-note' }, '微觀結構示意 · 光路與標記為視覺輔助 · 非實拍'),
    h('div', { class: 'bt' }, h('div', null, rd.gap, h('span', null, '離晶片端面')), h('div', null, rd.lat, h('span', null, '離波導入口（橫向）')),
      h('div', null, rd.tilt, h('span', null, '傾角')), h('div', null, rd.pw, h('span', null, '送進 PIC 的光'), h('div', { class: 'pm' }, pmBar))));
  body.append(h('div', { class: 'card dark fill', style: { padding: '6px' } }, hold));
  let M = new Micro3D(hold, ZT.run.w0), lastT = -1;   // 建頁時就建（配合預載），著色器在背景編譯
  const tr = createTransport(sc, (t) => frame(t), { idle: true, animateIdle: true });
  M.onInvalidate = () => tr.redraw();
  body.append(transportPanel(tr));
  function frame(t) {
    if (!M) return;
    const fin = clamp((t - R.total) / (FIN - 1.5), 0, 1), s = R.at(Math.min(t, R.total)), r = s.rel;
    const st = t >= R.total ? stages[3] : R.stages[s.stage - 1];
    const pw = s.db === null ? 0 : clamp(Math.pow(10, s.db / 10), 0, 1);
    if (t < lastT - 0.05 || s.stage < 3) M.clearTrail();
    lastT = t;
    M.update(r, pw, { mode, fin, time: t });
    if (s.stage === 3 && s.show >= 1) M.addTrail(M.T);
    if (!M.render()) return M.needsFrame;
    stTag.textContent = st.name; stTag.style.background = st.color;
    stepEl.textContent = t >= R.total ? (fin < 1 ? '光沿著 PIC 的波導往晶片裡面走' : '光已經進到晶片裡了') : s.step.replace(/（.*?）/g, '');
    big.style.opacity = t >= R.total && fin > 0.05 ? 1 : 0;
    rd.gap.textContent = fmtLen(r.gap); rd.lat.textContent = fmtLen(Math.hypot(r.dx, r.dy)); rd.tilt.textContent = `${s.tiltDeg.toFixed(2)}°`;
    rd.pw.textContent = s.db === null ? '還沒有光' : `${(pw * 100).toFixed(0)}%（${s.db.toFixed(1)} dB）`; pmBar.style.width = `${(pw * 100).toFixed(1)}%`;
    // 準星：PIC 波導入口（目標）
    const d = Math.min(2.5, Math.max(1.5, (window.devicePixelRatio || 1) * (window.__deckScale || 1))), w = hold.clientWidth, hh = hold.clientHeight;
    if (ov.width !== Math.round(w * d) || ov.height !== Math.round(hh * d)) { ov.width = Math.round(w * d); ov.height = Math.round(hh * d); ov.style.width = w + 'px'; ov.style.height = hh + 'px'; }
    const c = ov.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, w, hh);
    if (fin > 0.3) return M.needsFrame;
    const q = M.project(new Vector3(0, 0, 0));
    if (q.front && q.x > 0 && q.x < w && q.y > 0 && q.y < hh) {
      const on = pw > 0.5, col = on ? '#38d39f' : '#5fd4ff', rr = 24;
      c.strokeStyle = col; c.lineWidth = 2.5; c.beginPath(); c.arc(q.x, q.y, rr, 0, 7); c.stroke();
      for (const a of [0, 1, 2, 3]) { const ca = Math.cos(a * Math.PI / 2), sa = Math.sin(a * Math.PI / 2); c.beginPath(); c.moveTo(q.x + ca * (rr + 6), q.y + sa * (rr + 6)); c.lineTo(q.x + ca * (rr + 18), q.y + sa * (rr + 18)); c.stroke(); }
      c.font = '700 16px system-ui, "Microsoft JhengHei", sans-serif'; c.fillStyle = col; c.textAlign = 'left'; c.textBaseline = 'middle';
      const label = on ? '對上波導入口' : 'PIC 波導入口';
      const labelX = Math.min(w - c.measureText(label).width - 14, q.x + rr + 24);
      c.fillText(label, Math.max(14, labelX), q.y - 4);
    }
    return M.needsFrame;
  }
  return {
    show() { if (!M) M = new Micro3D(hold, ZT.run.w0); M.resize(); tr.loop.start(); },
    hide() { tr.loop.stop(); tr.pause(); },
  };
}

// ===================== 4. 陣列光纖對 PIC 實機動畫 =====================
export function faMachineSlide(body) {
  addCss(body);
  const R = buildFARun({ N: 8, P: 127 });
  const F = machineFrame(R.stages, `階段 3：壓電位移放大 ${R.AMP} 倍、角度放大 10 倍顯示`);
  F.plat.send('head', { v: 'fa' }); F.plat.send('pzpivot', { z: -0.875 });
  const ban = h('div', { class: 'mban' });
  const chips = h('div', { class: 'mchips' }, R.steps3.map((s, i) => h('span', null, `${i + 1}. ${s.name.replace(/：.*/, '')}`)));
  const stack = buildStack();
  const topCv = h('canvas'), sideCv = h('canvas'), mlTxt = h('div', { class: 'mml' });
  const facetCv = h('canvas', { style: { width: '100%', flex: '1', minHeight: '0', display: 'block', borderRadius: '8px', background: '#081120' } });
  const barCv = h('canvas', { style: { width: '100%', height: '130px', display: 'block', borderRadius: '8px', background: '#081120', flex: 'none' } });
  const pane = [h('div', null, stack.el), h('div', null, h('div', { class: 'mph' }, topCv, sideCv), mlTxt), h('div', null, facetCv, barCv)];
  const dyn = h('div', { class: 'mdyn' }, ...pane);
  const dro = buildDRO();
  const right = h('div', { class: 'card dark col machine-inspector', style: { padding: '10px 12px', gap: '8px' } }, evidence(), ban, chips, dyn, dro.el);
  body.append(h('div', { class: 'grid fill machine-layout', style: { gridTemplateColumns: '1.3fr 1fr' } },
    h('div', { class: 'card', style: { padding: '6px', background: '#0d1424' } }, F.holder), right));
  const topG = fitCanvas(topCv), sideG = fitCanvas(sideCv), fG = fitCanvas(facetCv), bG = fitCanvas(barCv);
  const tr = createTransport(R, (t) => frame(t), { idle: true });
  body.append(transportPanel(tr));
  let lastKey = '', lastCam = '', lastStage = 0, lastPane = -1;
  F.onAuto = () => { lastCam = ''; tr.redraw(); };
  function drawFacet(s) {
    const { ctx: c, w, h: H } = fG; if (!w) return;
    c.clearRect(0, 0, w, H);
    const N = R.N(), half = (N - 1) / 2, sx = (w - 60) / ((N - 1) * R.P()), cy = H * 0.42;
    c.font = '600 13px system-ui, "Microsoft JhengHei", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#cfe0ff'; c.fillText('端面正視 · 方塊 SSC / 圓點光斑 · 偏移 ×20', w / 2, 14);
    const K = 20;
    s.ch.forEach((q, i) => {
      const x = 30 + q.x * sx, good = q.db > -1;
      c.strokeStyle = 'rgba(95,212,255,.8)'; c.lineWidth = 1.5; c.strokeRect(x - 7, cy - 7, 14, 14);
      const px = x + q.ox * K, py = cy - q.oy * K;
      c.fillStyle = s.stage < 3 ? 'rgba(150,150,150,.4)' : good ? '#38d39f' : q.db > -10 ? '#ffb020' : '#ff6b5b';
      c.beginPath(); c.arc(clamp(px, 4, w - 4), clamp(py, 24, H - 24), 6, 0, 7); c.fill();
      c.fillStyle = i === 0 || i === N - 1 ? '#ffb86b' : '#93a6c6'; c.fillText(`ch${i + 1}`, x, cy + 30);
    });
    c.fillStyle = '#93a6c6'; c.fillText(`θz 還差 ${(s.rel.tz / DEG).toFixed(3)}°　θy 還差 ${(s.rel.tx / DEG).toFixed(3)}°　第 8 通道間距差 ${fmtLen(s.ch[N - 1].gap - s.ch[0].gap)}`, w / 2, H - 14);
  }
  function drawBars(s) {
    const { ctx: c, w, h: H } = bG; if (!w) return;
    c.clearRect(0, 0, w, H);
    const N = R.N(), bw = (w - 70) / N, y0 = 16, y1 = H - 22, Y = (db) => y0 + (y1 - y0) * clamp(-db / 30, 0, 1);
    c.font = '12px system-ui, sans-serif'; c.fillStyle = '#93a6c6'; c.textAlign = 'right'; c.textBaseline = 'middle';
    for (const db of [0, -10, -20, -30]) { c.fillText(`${db} dB`, 46, Y(db)); c.strokeStyle = 'rgba(140,170,230,.15)'; c.beginPath(); c.moveTo(52, Y(db)); c.lineTo(w - 8, Y(db)); c.stroke(); }
    c.strokeStyle = '#38d39f'; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(52, Y(-1)); c.lineTo(w - 8, Y(-1)); c.stroke(); c.setLineDash([]);
    s.ch.forEach((q, i) => {
      const x = 58 + i * bw, db = s.stage < 3 ? -60 : q.db;
      c.fillStyle = db > -1 ? '#38d39f' : db > -10 ? '#ffb020' : '#c2410c'; c.fillRect(x, Y(db), bw - 8, y1 - Y(db));
      c.fillStyle = i === 0 || i === N - 1 ? '#ffb86b' : '#cfe0ff'; c.textAlign = 'center'; c.fillText(`ch${i + 1}`, x + bw / 2 - 4, H - 10);
    });
    c.textAlign = 'right'; c.fillStyle = '#38d39f'; c.fillText('峰值 −1 dB', w - 10, Y(-1) - 8);
  }
  function frame(t) {
    const s = R.at(t), st = R.stages[s.stage - 1];
    F.plat.send('pose', { p: R.machinePose(s) });
    F.plat.send('chpow', { p: s.ch.map((q) => (s.stage < 3 ? 0 : clamp(Math.pow(10, q.db / 10), 0, 1))) });
    const key = s.stage + '|' + s.part.join();
    if (key !== lastKey) { lastKey = key; F.plat.send('hl', { ids: s.part, color: hex(st.color) }); }
    if (s.stage !== lastStage) { lastStage = s.stage; F.setStage(s.stage); F.plat.send('hide', { ids: ['R18', 'R19'], on: s.stage === 3 }); }   // 精對位時藏起相機，才看得到光纖頭
    if (F.autoCam && s.cam !== lastCam) { lastCam = s.cam; camTo(F.plat, s.cam); }
    ban.textContent = s.step; ban.style.borderColor = st.color;
    [...chips.children].forEach((el, i) => { el.className = s.stage < 3 || s.s3 < i ? '' : s.s3 === i ? 'on' : 'done'; el.style.background = s.stage === 3 && s.s3 === i ? SCOL[2] : ''; });
    chips.style.visibility = s.stage === 3 ? 'visible' : 'hidden';
    const pi = s.stage - 1;
    if (pi !== lastPane) { lastPane = pi; pane.forEach((p, i) => p.classList.toggle('on', i === pi)); topG.apply(); sideG.apply(); fG.apply(); bG.apply(); }
    const act = dro.update(s); stack.update(act);
    const r = s.rel, N = R.N();
    F.hud.innerHTML = `<b>${st.name}</b><div class="mono">第 1 通道離目標：X ${fmtLen(r.dx)}　Y ${fmtLen(r.dy)}　間距 ${fmtLen(r.gap)}　θz ${(r.tz / DEG).toFixed(3)}°<br>${s.stage < 3 ? '功率計：還沒有光' : `ch1 ${s.ch[0].db.toFixed(1)} dB　ch${N} ${s.ch[N - 1].db.toFixed(1)} dB`}</div>`;
    if (s.stage === 2) {
      const shotT = 7 + s.shot * 3, flash = clamp(1 - (t - shotT) / 0.35, 0, 1), m = s.ml;
      const pose = r;
      drawCamPhoto(topG, { view: 'top', kind: 'fa', pose, fov: 2600, flash: flash * .12, ml: { u: -(m.gap), v: m.dx, label: `ML：X ${m.dx.toFixed(0)} µm、間距 ${m.gap.toFixed(0)} µm` }, title: `上視相機（示意，第 ${s.shot + 1} 張）` });
      drawCamPhoto(sideG, { view: 'side', kind: 'fa', pose, fov: 2600, flash: flash * .12, ml: { u: -(m.gap), v: m.dy, label: `ML：Y ${m.dy.toFixed(0)} µm` }, title: `側視相機（示意，第 ${s.shot + 1} 張）` });
      mlTxt.innerHTML = `<b>ML 估計（示意值）</b>　X ${m.dx.toFixed(0)}　Y ${m.dy.toFixed(0)}　間距 ${m.gap.toFixed(0)} µm　θz ${m.roll.toFixed(2)}°（相對相機階段終點）`;
    }
    if (s.stage === 3) { drawFacet(s); drawBars(s); }
  }
  frame(0);
  return {
    // 固定 8 通道、127 µm 的獨立情境，不改動其他頁面的陣列設定。
    show() { tr.loop.start(); tr.redraw(); lastKey = lastCam = ''; lastStage = 0; lastPane = -1; F.plat.send('head', { v: 'fa' }); topG.apply(); sideG.apply(); fG.apply(); bG.apply(); },
    hide() { tr.loop.stop(); tr.pause(); },
  };
}

// ===================== 5. 統整 =====================
export function summarySlide(body) {
  addCss(body);
  const R = buildMachineRun(), RUN = ZT.run;
  const finalDb = R.at(R.total).db;
  const couplingEfficiency = finalDb === null ? '—' : (Math.pow(10, finalDb / 10) * 100).toFixed(1);
  const cv = h('canvas', { class: 'cv', style: { height: '240px' } });
  const cvP = h('canvas', { class: 'cv', style: { height: '200px' } });          // 耦合光功率對時間
  const mx = h('table', { class: 'tb mx' },
    h('tr', null, h('th', null, '軸'), h('th', null, '階段 1 粗動'), h('th', null, '階段 2 相機＋ML'), h('th', null, '階段 3 壓電精對位')));
  const row = (name, a, b, c, col) => mx.append(h('tr', null, h('td', null, h('b', { style: { color: col } }, name)),
    h('td', { class: a[1] }, a[0]), h('td', { class: b[1] }, b[0]), h('td', { class: c[1] }, c[0])));
  const gh = (t) => mx.append(h('tr', { class: 'gh' }, h('td', { colspan: 4 }, t)));
  const lin = ['大行程移動', 'c1'], linb = ['依 ML 修正', 'c2'], lock = ['鎖定', 'c0'], idle = ['待命', 'c0'], run = ['運動', 'c3'];
  gh(GROUPS[0]); for (const a of ['X', 'Y', 'Z']) row(a, lin, linb, lock, GCOL[0]);
  gh(GROUPS[1]); for (const a of ['θx', 'θy', 'θz']) row(a, ['轉正', 'c1'], linb, lock, GCOL[1]);
  gh(GROUPS[2]); row('X、Y', idle, idle, ['螺旋找光、繞圈梯度', 'c3'], GCOL[2]); row('Z', idle, idle, ['量間距、靠近', 'c3'], GCOL[2]); row('θx θy θz', idle, idle, ['最後微調；陣列轉 θz', 'c3'], GCOL[2]);
  const card = (n, unit, txt, c) => h('div', { class: 'validation-kpi', style: { '--kpi-color': c } },
    h('span', null, txt), h('strong', null, n, h('small', null, unit)));
  cv.classList.add('summary-chart'); cvP.classList.add('summary-chart');
  cv.setAttribute('aria-label', '對位誤差隨示意時間縮小的模擬曲線');
  cvP.setAttribute('aria-label', '耦合功率隨示意時間變化的模擬曲線');
  body.append(evidence('本頁整理設計規格與單次模擬；實機精度與重複性待量測'),
    h('div', { class: 'validation-kpis' },
      card('48 → 0.7', ' mm', '粗動接近範例', '#8db9e2'), card('±40 / ±50', ' µm', '相機 XY / 間距規格', '#bfa8eb'),
      card(RUN.gapErr.toFixed(2), ' µm', '最終間距誤差 · 單次模擬', '#edbe89'), card((RUN.xyRes * 1000).toFixed(0), ' nm', '最終核心偏差 · 單次模擬', '#edbe89'),
      card(couplingEfficiency, ' %', '光耦合效率 · 單次模擬', '#9bd3c0')),
    h('div', { class: 'grid fill summary-layout' },
      h('div', { class: 'card col summary-curves' },
        h('h2', null, '對位收斂歷程'), h('p', { class: 'summary-sub' }, '先進入相機視野，再由壓電平台完成微調'), cv,
        h('h3', null, '耦合光功率'), cvP),
      h('div', { class: 'card col summary-matrix' }, h('h2', null, '12 軸的分工'), h('p', { class: 'summary-sub' }, '3 軸粗動 ＋ 3 軸角度 ＋ 6 軸壓電'), mx,
        h('div', { class: 'validation-footnote' }, h('b', null, '如何閱讀結果'),
          h('p', null, '曲線承接同一次 XYZ 模擬；角度微調與粗動路徑為示意。奈米級核心偏差是單次模擬結果，不代表機台已達到此精度。'),
          h('span', null, '下一步：實機重複測試、漂移與多通道功率量測。')))));
  let g = null, gP = null;
  const ts = [], err = [], pdb = [], FLOOR = -50;                  // 功率：功率計讀數（同進度報告動畫那次模擬）；還沒有光時畫在偵測下限
  for (let i = 0; i <= 500; i++) { const t = (R.total * i) / 500, s = R.at(t); ts.push(t); err.push(Math.log10(Math.max(s.errUm, 0.01))); pdb.push(s.db === null ? FLOOR : Math.max(FLOOR, s.db)); }
  const yfmt = (v) => ({ '-2': '10 nm', '-1': '0.1 µm', '0': '1 µm', '1': '10 µm', '2': '100 µm', '3': '1 mm', '4': '10 mm' }[String(v)] || '');
  const draw = () => { if (!g || !gP) return; if (g.w) drawPlot(g, {
    margin: { l: 78 }, xlim: [0, R.total], ylim: [-2.2, 4.9], xlabel: '示意時間（s）', ylabel: '離目標的距離', yticks: [-2, -1, 0, 1, 2, 3, 4], yfmt,
    series: [{ x: ts, y: err, color: '#1f3a5f', width: 3 }], vlines: R.stages.map((s) => ({ x: s.t0, color: s.color, label: s.short, dash: [3, 3] })),
    hlines: [{ y: Math.log10(40), color: '#7048c9', label: '相機規格 ±40 µm' }],
  }); if (gP.w) drawPlot(gP, {
    margin: { l: 78 }, xlim: [0, R.total], ylim: [FLOOR - 2, 2], xlabel: '示意時間（s）', ylabel: '耦合光功率（dB）', yticks: [0, -10, -20, -30, -40, -50],
    series: [{ x: ts, y: pdb, color: '#e8590c', width: 3 }], vlines: R.stages.map((s) => ({ x: s.t0, color: s.color, label: s.short, dash: [3, 3] })),
    hlines: [{ y: FLOOR, color: '#8a94a6', label: '無光時以 −50 dB 示意' }],
  }); };
  g = fitCanvas(cv, () => draw()); gP = fitCanvas(cvP, () => draw());   // 尺寸確定（或縮放）後重畫
  return { show() { g.apply(); gP.apply(); draw(); } };
}
