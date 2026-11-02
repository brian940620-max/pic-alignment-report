// 三階段對位情境（動畫時間軸）。長度 µm、角度 rad。
// 階段 1、2 是示意的運動曲線（起點與終點為示意值）；階段 3 的軌跡由 align.js 以 physics.js 的耦合效率實際算出。
import { eta, beamAt, PRESETS } from './physics.js';
import { planAlignment } from './align.js';
import { h, segmented, loop, ease, clamp, lerp, DEG } from './ui.js';

export const STAGES = [
  { id: 1, name: '階段 1：粗動，把光纖送進相機視野', short: '粗動', color: '#3b6ea8',
    axes: 'XYZ 粗動 3 軸 ＋ 角度粗動 3 軸', accuracy: '毫米 → 約 0.2–0.5 mm',
    what: '大行程平台把透鏡光纖從遠處帶到晶片端面附近，並預先把傾角調到大致平行。目標只有一個：讓光纖尖端進入上視與側視相機的視野。',
    spec: '行程與解析度依選型而定（平台規格待確認）' },
  { id: 2, name: '階段 2：相機＋ML，量出位置再修正', short: '相機＋ML', color: '#7048c9',
    axes: '同一組 XYZ 粗動 ＋ 角度粗動（相機回饋）', accuracy: '→ XY ±40 µm、間距 ±50 µm、傾斜 ±2.5° 以內',
    what: '上視與側視相機各拍一張，ML 模型估出光纖與晶片端面的 X、Y、間距與傾角，粗動平台依估計值修正，重複 2–3 次。',
    spec: '模擬測試集 94.3% 達標；難度 4 的誤差 RMSE：XY 約 6 µm、間距約 7 µm、傾斜約 0.31°（光纖對光纖的模擬影像，PIC 版需重訓）' },
  { id: 3, name: '階段 3：奈米壓電精對位，靠光功率回饋', short: '精對位', color: '#e8590c',
    axes: '6 軸奈米壓電（XYZ ＋ 3 角度，同一個旋轉中心）', accuracy: '→ 數十 nm，耦合效率達峰值',
    what: '相機已經看不出差異，改看光功率：先螺旋掃描找首光，再用繞圈梯度把光點中心拉到波導中心，並調整間距讓焦點落在端面，最後微調角度。',
    spec: '軌跡由本頁的高斯耦合模型即時算出（示意參數，不是實機結果）' },
];

const UM = 1;
export function buildScenario(p) {
  const WD = p.WD;
  // 粗動從行程最遠處出發（報價機台：Z、X 用 50 mm 滑台，Y 約 ±5 mm；示意值）
  const start0 = { dx: 24000 * UM, dy: 4500, gap: 48000, tx: 3.0 * DEG, ty: -2.5 * DEG };
  const end1 = { dx: 240, dy: -180, gap: 620, tx: 2.1 * DEG, ty: -1.6 * DEG };
  const end2 = { dx: 14, dy: -9, gap: WD + 22, tx: 0.25 * DEG, ty: -0.18 * DEG };
  const T = { s1: 16, s2: 9, s3: 11, trim: 2.5, tail: 1.5 };   // 粗動放慢，讓三段看得出來
  const t1 = T.s1, t2 = t1 + T.s2, t3 = t2 + T.s3 + T.trim, total = t3 + T.tail;
  const plan = planAlignment(p, { ...end2 });
  const fr = plan.frames, ev = plan.events;
  const nF = fr.length - 1;
  const iFL = ev.firstLightIdx ?? Math.floor(nF * 0.3), iDone = ev.doneIdx ?? nF;
  const mapFrame = (u) => {          // u∈[0,1] → 幀序號（分段，讓找光與收斂各占合理時間）
    if (u <= 0.35) return Math.round((u / 0.35) * iFL);
    if (u <= 0.9) return Math.round(iFL + ((u - 0.35) / 0.55) * (iDone - iFL));
    return Math.round(iDone + ((u - 0.9) / 0.1) * (nF - iDone));
  };
  const last = fr[nF];
  const noise = (k) => { const s = Math.sin(k * 12.9898) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };

  const stages = [
    { ...STAGES[0], t0: 0, t1 }, { ...STAGES[1], t0: t1, t1: t2 }, { ...STAGES[2], t0: t2, t1: t3 },
  ];

  function at(t) {
    t = clamp(t, 0, total);
    let pose, stage, phase = 'idle', snap = false, info = '', pmv = null;
    if (t < t1) {
      stage = 1;
      const u = t / T.s1;
      const win = (a, b) => ease((u - a) / (b - a));
      const fx = win(0, 0.65), fy = win(0.1, 0.75), fz = win(0.25, 1), fa = win(0.45, 1);
      pose = {
        dx: lerp(start0.dx, end1.dx, fx), dy: lerp(start0.dy, end1.dy, fy), gap: lerp(start0.gap, end1.gap, fz),
        tx: lerp(start0.tx, end1.tx, fa), ty: lerp(start0.ty, end1.ty, fa),
      };
      info = '粗動平台大行程移動，光纖朝晶片靠近';
    } else if (t < t2) {
      stage = 2;
      const u = (t - t1) / T.s2, k = Math.min(2, Math.floor(u * 3)), uu = u * 3 - k;
      const rem = [1, 0.35, 0.08, 0];           // 每次修正後，剩下的誤差比例
      const a = rem[k], b = rem[k + 1];
      const shoot = uu < 0.28;
      const f = shoot ? 0 : ease((uu - 0.28) / 0.72);
      const m = lerp(a, b, f);
      pose = {
        dx: end2.dx + (end1.dx - end2.dx) * m, dy: end2.dy + (end1.dy - end2.dy) * m, gap: end2.gap + (end1.gap - end2.gap) * m,
        tx: end2.tx + (end1.tx - end2.tx) * m, ty: end2.ty + (end1.ty - end2.ty) * m,
      };
      snap = shoot;
      info = shoot ? `第 ${k + 1} 次拍照：ML 估計位置與傾角` : `第 ${k + 1} 次修正：粗動平台依 ML 估計移動`;
    } else if (t < t2 + T.s3) {
      stage = 3;
      const u = (t - t2) / T.s3, fi = clamp(mapFrame(u), 0, nF), f = fr[fi];
      pose = { dx: f.dx, dy: f.dy, gap: f.gap, tx: end2.tx, ty: end2.ty };
      phase = f.phase; pmv = f.pm;
      info = { spiral: '螺旋掃描找首光', circle: '繞圈取樣，估計梯度方向', zprobe: 'Z 方向前後探測，找焦點位置', move: '移到新的圓心', hold: '已對準' }[f.phase];
    } else {
      stage = 3;
      const u = clamp((t - t2 - T.s3) / T.trim, 0, 1), e = ease(u);
      const txn = end2.tx * (1 - e), tyn = end2.ty * (1 - e);
      pose = { dx: last.dx + last.gap * (end2.tx - txn), dy: last.dy + last.gap * (end2.ty - tyn), gap: last.gap, tx: txn, ty: tyn };
      phase = 'hold'; info = u < 1 ? '微調角度（繞端面中心轉）' : '精對位完成';
    }
    const e = eta(p, pose);
    const errUm = Math.hypot(pose.dx, pose.dy, pose.gap - WD);
    const coarse = stage < 3
      ? { x: pose.dx, y: pose.dy, z: -pose.gap, tx: pose.tx, ty: pose.ty, tz: 0 }
      : { x: end2.dx, y: end2.dy, z: -end2.gap, tx: end2.tx, ty: end2.ty, tz: 0 };
    const piezo = stage < 3 ? { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0 }
      : { x: pose.dx - end2.dx, y: pose.dy - end2.dy, z: -(pose.gap - end2.gap), tx: pose.tx - end2.tx, ty: pose.ty - end2.ty, tz: 0 };
    let ml = null;
    if (stage === 2) {
      const k = Math.min(2, Math.floor(((t - t1) / T.s2) * 3));
      ml = { dx: pose.dx + 6 * noise(k + 1), dy: pose.dy + 6 * noise(k + 5), gap: pose.gap + 7 * noise(k + 9), tilt: (Math.hypot(pose.tx, pose.ty) / DEG) + 0.31 * noise(k + 13) };
    }
    return { t, stage, pose, coarse, piezo, eta: e, pm: pmv ?? e, phase, snap, info, errUm, ml, tiltDeg: Math.hypot(pose.tx, pose.ty) / DEG };
  }
  return { total, stages, at, plan, T, end1, end2, start0 };
}

let _def=null;
export function defaultScenario() { if (!_def) _def = buildScenario({ ...PRESETS.lensedSSC.p }); return _def; }

// 播放控制列（兩個頁面共用）。onTime(t) 每幀呼叫；回傳 {el, get t, set(t), loop}
// opts.idle：暫停時不必每幀重畫（機台頁）。只在時間有走、拖時間軸、換尺寸或 redraw() 時畫，另外每 0.5 s 補一次
export function createTransport(sc, onTime, opts = {}) {
  let t = 0, playing = false, speed = 1, dirty = true, lastRun = 0;
  const lp = loop((dt, now) => {
    if (playing) { t += dt * speed; if (t >= sc.total) { t = sc.total; playing = false; btn.textContent = '↻ 重播'; } slider.value = t * 100; label(); dirty = true; }
    if (!opts.idle || dirty || now - lastRun > 0.5) { dirty = false; lastRun = now; onTime(t); }
  });
  if (opts.idle) for (const ev of ['resize', 'deckscale']) window.addEventListener(ev, () => { dirty = true; });
  const btn = h('button', { class: 'btn', type: 'button', onclick: () => { if (t >= sc.total - 0.01) t = 0; playing = !playing; btn.textContent = playing ? '⏸ 暫停' : '▶ 播放'; } }, '▶ 播放');
  const slider = h('input', { type: 'range', min: 0, max: Math.round(sc.total * 100), value: 0, style: { width: '100%' } });
  slider.addEventListener('input', () => { t = +slider.value / 100; playing = false; btn.textContent = '▶ 播放'; label(); onTime(t); });
  const time = h('span', { class: 'mono small' });
  const label = () => { time.textContent = `${t.toFixed(1)} / ${sc.total.toFixed(0)} s（示意時間軸）`; };
  const speedSeg = segmented([{ id: '0.5', label: '0.5×' }, { id: '1', label: '1×' }, { id: '2', label: '2×' }], '1', (id) => { speed = +id; });
  const marks = h('div', { style: { display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', margin: '2px 0 6px' } },
    sc.stages.map((s) => h('div', { style: { flex: `${s.t1 - s.t0}`, background: s.color, opacity: 0.8 } })));
  const jump = h('div', { class: 'row' }, sc.stages.map((s) => h('button', { class: 'btn ghost', type: 'button', onclick: () => { t = s.t0 + 0.01; slider.value = t * 100; label(); onTime(t); } }, `跳到 ${s.short}`)));
  label();
  const el = h('div', { class: 'card' }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('div', { class: 'row' }, btn, speedSeg.el, time), jump), marks, slider);
  return {
    el, loop: lp, get t() { return t; },
    set(v) { t = clamp(v, 0, sc.total); slider.value = t * 100; label(); onTime(t); },
    pause() { playing = false; btn.textContent = '▶ 播放'; },
    redraw() { dirty = true; },
  };
}
export { beamAt };
