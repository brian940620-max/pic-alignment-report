// 計畫版 2-1 第 1 頁「XY 平面模場建模」（2026-11-02）：照 10-01 進度報告（Desktop/1001_v3.pptx 第 3、8 頁）的共同模擬平台
//   主峰＝圓對稱高斯 σ 1.5 µm（Joyce & DeLoach 1984）；背景 120×120 µm、12 個靜態假峰（各 0.1–3%、σ 0.5–2 µm、
//   離主峰 ≥8 µm、彼此 ≥6 µm、疊加 ≤3%）；量測雜訊 0.3%。設定照 2D_alignment_sim/production2DBenchmarkConfig.m。
// 假峰位置用本頁自己的亂數（不是 MATLAB 的種子），只示意分佈。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { h, fitCanvas, loop, clamp } from '../ui.js';
import { tex } from '../tex.js';

const SIG = 1.5, HALF = 60, NB = 12;
const PAR = [[53, 42, 135], [15, 92, 221], [20, 129, 214], [6, 164, 202], [46, 183, 164], [135, 191, 119], [209, 187, 89], [254, 200, 50], [249, 251, 14]];
const parula = (t) => { t = clamp(t, 0, 1) * (PAR.length - 1); const i = Math.min(PAR.length - 2, Math.floor(t)), f = t - i; return PAR[i].map((v, k) => v + (PAR[i + 1][k] - v) * f); };

function makeScene(seed) {   // 主峰位置＋12 個假峰（拒絕取樣，同 createProduction2DScenario 的規則）
  let s = seed; const u = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const ang = u() * 2 * Math.PI, rr = 54 * Math.sqrt(u());
  const main = [rr * Math.cos(ang), rr * Math.sin(ang)], bumps = [];
  while (bumps.length < NB) {
    const p = [(u() * 2 - 1) * 59, (u() * 2 - 1) * 59];
    if (Math.hypot(p[0] - main[0], p[1] - main[1]) < 8 || bumps.some((b) => Math.hypot(p[0] - b.x, p[1] - b.y) < 6)) continue;
    bumps.push({ x: p[0], y: p[1], a: 0.001 + u() * 0.029, sx: 0.5 + u() * 1.5, sy: 0.5 + u() * 1.5 });
  }
  const bump = (x, y) => bumps.reduce((acc, b) => acc + b.a * Math.exp(-((x - b.x) ** 2) / (2 * b.sx ** 2) - ((y - b.y) ** 2) / (2 * b.sy ** 2)), 0);
  let mx = 0; for (let x = -HALF; x <= HALF; x += 0.5) for (let y = -HALF; y <= HALF; y += 0.5) mx = Math.max(mx, bump(x, y));
  const k = mx > 0.03 ? 0.03 / mx : 1;   // 疊加上限 3%
  const P = (x, y) => Math.exp(-((x - main[0]) ** 2 + (y - main[1]) ** 2) / (2 * SIG * SIG)) + k * bump(x, y);
  return { main, bumps, P };
}

const CSS = `
.sp21 .card.dark { padding:10px 14px; }
.sp21 .k-h { font-size:18px; font-weight:800; color:#fff; margin:0 0 4px; }
.sp21 .k-ul { margin:0; padding-left:20px; font-size:15.5px; line-height:1.5; color:#e8eefb; } .sp21 .k-ul b { color:#ffd29a; }
.sp21 .src { font-size:12.5px; color:#93a6c6; line-height:1.4; }
.sp21 .pane { position:relative; min-height:0; border-radius:10px; overflow:hidden; background:#0b1426; }
.sp21 .pane > canvas { position:absolute; inset:0; width:100%; height:100%; display:block; }
.sp21 .tag { position:absolute; left:10px; top:8px; z-index:2; font-size:14.5px; font-weight:700; color:#fff; background:rgba(8,14,28,.75); padding:2px 10px; border-radius:99px; pointer-events:none; }
.sp21 .tex { font-size:22px; } .sp21 .tex.sm { font-size:19px; }
.sp21 .kps { display:grid; grid-template-columns:1fr 1fr; gap:10px; align-content:center; }
.sp21 .kp { background:rgba(255,255,255,.04); border:1px solid rgba(140,170,230,.2); border-radius:12px; padding:12px 6px; text-align:center; }
.sp21 .kp b { display:block; font-family:var(--mono); font-size:34px; font-weight:800; color:#ffb86b; line-height:1.15; }
.sp21 .kp span { font-size:15px; color:#cfd9ec; }
.sp21 .rd2 { font-family:var(--mono); font-size:14.5px; color:#cfd9ec; } .sp21 .rd2 b { color:#ffb86b; }
`;
const pane = (c, tag) => { c.style.position = 'absolute'; return h('div', { class: 'pane fill' }, c, tag ? h('div', { class: 'tag' }, tag) : null); };

function xySlide(body) {
  const st = { mode: 'lin', seed: 20260920, sc: null };
  st.sc = makeScene(st.seed);
  // ---- 3D 高斯山峰（主峰附近） ----
  const holder = h('div', { class: 'pane fill' });
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  holder.append(renderer.domElement, h('div', { class: 'tag' }, '主峰：高斯山峰（拖曳旋轉）'));
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  cam.position.set(14, 12, 16);
  const ctl = new OrbitControls(cam, renderer.domElement); ctl.enableDamping = true; ctl.target.set(0, 0.9, 0); ctl.autoRotate = true; ctl.autoRotateSpeed = 0.8;
  scene.add(new THREE.AmbientLight(0xffffff, 0.75)); const dl = new THREE.DirectionalLight(0xffffff, 1.1); dl.position.set(4, 10, 6); scene.add(dl);
  const N = 90, geo = new THREE.PlaneGeometry(10, 10, N, N); geo.rotateX(-Math.PI / 2);
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide }));
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.PlaneGeometry(10, 10, 30, 30).rotateX(-Math.PI / 2)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 }));
  scene.add(mesh, wire);
  const ring = (r, col) => { const g = new THREE.BufferGeometry().setFromPoints([...Array(97)].map((_, i) => new THREE.Vector3(Math.cos(i / 96 * 2 * Math.PI) * r, 0.01, Math.sin(i / 96 * 2 * Math.PI) * r))); return new THREE.Line(g, new THREE.LineBasicMaterial({ color: col })); };
  const rings = new THREE.Group(); scene.add(rings);
  function shape() {   // 高度＝P（線性，真實形狀）；dB 模式程式保留，計畫版只用線性
    const span = st.mode === 'lin' ? 4 * SIG : 6 * SIG, pos = geo.attributes.position, col = geo.attributes.color, wpos = wire.geometry.attributes.position;
    const zOf = (x, y) => { const p = Math.exp(-(x * x + y * y) / (2 * SIG * SIG)); return st.mode === 'lin' ? p : clamp((10 * Math.log10(Math.max(p, 1e-6)) + 30) / 30, 0, 1); };
    const fill = (pa, withCol) => { for (let i = 0; i < pa.count; i++) {
      const gx = (pa.getX(i) / 5) * span, gy = (pa.getZ(i) / 5) * span, z = zOf(gx, gy);
      pa.setY(i, z * 2.4); if (withCol) { const c = parula(z); col.setXYZ(i, c[0] / 255, c[1] / 255, c[2] / 255); } } pa.needsUpdate = true; };
    // 線框用原始平面座標重算（WireframeGeometry 的頂點是 x,z 平面）
    fill(pos, true); geo.computeVertexNormals(); col.needsUpdate = true;
    for (let i = 0; i < wpos.count; i++) { const gx = (wpos.getX(i) / 5) * span, gy = (wpos.getZ(i) / 5) * span; wpos.setY(i, zOf(gx, gy) * 2.4 + 0.01); } wpos.needsUpdate = true;
    rings.clear();
    for (const [r, c] of [[SIG * Math.sqrt(-2 * Math.log(0.99)), 0xffffff], [SIG * Math.sqrt(-2 * Math.log(10 ** -0.1)), 0xff7a1a]]) { const g = ring((r / span) * 5, c); rings.add(g); }
  }
  const fit3 = () => { const w = holder.clientWidth, H = holder.clientHeight; if (w < 2 || H < 2) return; renderer.setSize(w, H, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; cam.aspect = w / H; cam.updateProjectionMatrix(); };
  new ResizeObserver(fit3).observe(holder);
  const anim = loop(() => { ctl.update(); renderer.render(scene, cam); });

  // ---- 120×120 µm 地圖（dB） ----
  const cm = h('canvas'), M = fitCanvas(cm, () => { mapImg = null; drawMap(); });
  let mapImg = null, probe = null;
  const rd = h('div', { class: 'rd2' }, '點地圖看該點功率');
  function drawMap() {
    const { ctx, w, h: H } = M; if (!w) return;
    const sz = Math.min(w - 80, H - 30), ox = 34, oy = (H - sz) / 2, X = (x) => ox + ((x + HALF) / (2 * HALF)) * sz, Y = (y) => oy + ((HALF - y) / (2 * HALF)) * sz;
    if (!mapImg) { const n = 241, img = new ImageData(n, n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = -HALF + i * 0.5, y = HALF - j * 0.5, db = 10 * Math.log10(Math.max(st.sc.P(x, y), 1e-8)); const c = parula(1 + db / 75), o = (j * n + i) * 4; img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255; }
      mapImg = document.createElement('canvas'); mapImg.width = n; mapImg.height = n; mapImg.getContext('2d').putImageData(img, 0, 0); }
    ctx.fillStyle = '#0b1426'; ctx.fillRect(0, 0, w, H);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(mapImg, ox, oy, sz, sz);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.strokeRect(ox, oy, sz, sz);
    ctx.font = '12px system-ui, "Microsoft JhengHei", sans-serif'; ctx.fillStyle = '#93a6c6'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const v of [-60, -30, 0, 30, 60]) { ctx.fillText(v, ox - 4, Y(v)); ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(v, X(v), oy + sz + 3); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; }
    // 色條
    for (let i = 0; i < sz; i++) { const c = parula(1 - i / sz); ctx.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; ctx.fillRect(ox + sz + 6, oy + i, 8, 1.5); }
    ctx.fillStyle = '#93a6c6'; ctx.textAlign = 'left'; ctx.fillText('0 dB', ox + sz + 2, oy - 8); ctx.fillText('−75', ox + sz + 17, oy + sz - 6);
    const [mx, my] = st.sc.main; ctx.fillStyle = '#ff3df2'; ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★', X(mx), Y(my));
    if (probe) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(probe[0]), Y(probe[1]), 7, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
    st.mapGeom = { ox, oy, sz };
  }
  cm.addEventListener('click', (e) => {
    const g = st.mapGeom; if (!g) return; const r = cm.getBoundingClientRect(), sc = r.width / M.w;
    const px = (e.clientX - r.left) / sc, py = (e.clientY - r.top) / sc;
    const x = -HALF + ((px - g.ox) / g.sz) * 2 * HALF, y = HALF - ((py - g.oy) / g.sz) * 2 * HALF;
    if (Math.abs(x) > HALF || Math.abs(y) > HALF) return;
    probe = [x, y]; const p = st.sc.P(x, y), d = Math.hypot(x - st.sc.main[0], y - st.sc.main[1]);
    rd.innerHTML = `(${x.toFixed(1)}, ${y.toFixed(1)}) µm　功率 <b>${p >= 1e-4 ? (p * 100).toPrecision(3) + '%' : p.toExponential(1)}</b>（${(10 * Math.log10(Math.max(p, 1e-12))).toFixed(1)} dB）　離主峰 <b>${d.toFixed(1)} µm</b>`;
    drawMap();
  });

  const bNew = h('button', { type: 'button', class: 'btn ghost', onclick: () => { st.seed = (st.seed * 48271) % 2147483647; st.sc = makeScene(st.seed); mapImg = null; probe = null; rd.textContent = '點地圖看該點功率'; drawMap(); } }, '換一組場景');
  const kpi = (v, l) => h('div', { class: 'kp' }, h('b', null, v), h('span', null, l));

  body.append(h('div', { class: 'grid grow', style: { gridTemplateColumns: '1fr 0.95fr 0.82fr' } },
    h('div', { class: 'card dark col', style: { gap: '6px' } }, holder),
    h('div', { class: 'card dark col', style: { gap: '6px' } },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { style: { color: '#fff', fontWeight: 700 } }, '整個搜尋區 120 × 120 µm（dB）'), bNew),
      pane(cm)),
    h('div', { class: 'col' },
      h('div', { class: 'card dark col', style: { gap: '2px' } },
        h('div', { class: 'k-h' }, 'XY 光斑＝二維高斯'),
        tex('P(x,y)=A\\,\\exp\\!\\left[-\\frac{(x-x_0)^2+(y-y_0)^2}{2\\sigma^2}\\right]'),
        tex('\\sigma=\\tfrac{1}{2}\\sqrt{w_1^2+w_2^2}', 'sm')),
      h('div', { class: 'card dark fill kps' },
        kpi('1.5 µm', 'σ（模擬設定）'), kpi('0.21 µm', '損耗 1% 的容差'), kpi('1.02 µm', '損耗 1 dB 的容差'), kpi('3%', '假峰最高（相對主峰）')),
      h('div', { class: 'src' }, 'W. B. Joyce, B. C. DeLoach, Appl. Opt. 23, 4187 (1984)'))));
  body.prepend(h('style', null, CSS));
  body.closest('.slide').classList.add('sp21');
  shape(); drawMap();
  return { show() { fit3(); anim.start(); drawMap(); }, hide() { anim.stop(); } };
}

export function mount(sec) {
  sec.slide({ title: 'XY 平面模場建模', sub: '' }, xySlide);
}
