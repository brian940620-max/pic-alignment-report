// 計畫版 2-1 第 1 頁「XY 平面模場建模」（2026-11-02）：照 10-01 進度報告（Desktop/1001_v3.pptx 第 3、8 頁）的共同模擬平台
//   2D／3D 共用完整 120×120 µm 場景及 dB 色階；3D 高度以 P^0.1 壓縮動態範圍，保留鐘形輪廓。主峰＝圓對稱高斯 σ 1.5 µm（Joyce & DeLoach 1984）；12 個靜態假峰（各 0.1–3%、σ 0.5–2 µm、
//   離主峰 ≥8 µm、彼此 ≥6 µm、疊加 ≤3%）；量測雜訊 0.3%。設定照 2D_alignment_sim/production2DBenchmarkConfig.m。
// 假峰位置用本頁自己的亂數（不是 MATLAB 的種子），只示意分佈。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { h, fitCanvas, loop, clamp } from '../ui.js';
import { tex } from '../tex.js';
import { fieldRGB as terrainColor, writeFieldPixel } from '../presentation-palette.js';
import { makeScene } from '../xy-field.js';

const SIG = 1.5, HALF = 60;
const PAR = [[53, 42, 135], [15, 92, 221], [20, 129, 214], [6, 164, 202], [46, 183, 164], [135, 191, 119], [209, 187, 89], [254, 200, 50], [249, 251, 14]];
const parula = (t) => { t = clamp(t, 0, 1) * (PAR.length - 1); const i = Math.min(PAR.length - 2, Math.floor(t)), f = t - i; return PAR[i].map((v, k) => v + (PAR[i + 1][k] - v) * f); };

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
  const st = { mode: 'full', seed: 20260920, sc: makeScene(20260920) };
  // Color and measured power stay shared. Log-height turns Gaussians into clipped
  // paraboloids; a power transform keeps a smooth bell and reveals weak peaks.
  const N = 360, FLOOR_DB = -75, HEIGHT = 2.6, HEIGHT_POWER = .1;
  const colorLevel = power => clamp(1 - 10 * Math.log10(Math.max(power, 1e-12)) / FLOOR_DB, 0, 1);
  const surfaceHeight = power => HEIGHT * Math.pow(Math.max(0, power), HEIGHT_POWER);
  let field;
  const holder = h('div', { class: 'pane fill' });
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.domElement.setAttribute('aria-label', '與右側熱圖同步的三維功率地形，可拖曳旋轉');
  holder.append(renderer.domElement);
  // Orthographic projection makes the top view line up with the 2D map, regardless of peak height.
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-10, 10, 7, -7, 0.1, 100);
  const fullGroup = new THREE.Group(), peakGroup = new THREE.Group();
  scene.add(fullGroup, peakGroup); peakGroup.visible = false;
  let topView = false;
  cam.position.set(9, 9, 15);
  const ctl = new OrbitControls(cam, renderer.domElement);
  ctl.enableDamping = true; ctl.target.set(0, 1.6, 0);
  ctl.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  ctl.autoRotateSpeed = 1.2;
  ctl.minDistance = 9; ctl.maxDistance = 35; ctl.maxPolarAngle = Math.PI * 0.48;
  const geo = new THREE.PlaneGeometry(10, 10, N, N); geo.rotateX(-Math.PI / 2);
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
  // Soft surface lighting reveals slopes; scalar color mapping is shared with the heatmap.
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.08, side: THREE.DoubleSide }));
  fullGroup.add(mesh);
  const base = new THREE.Mesh(new THREE.BoxGeometry(10.05, 0.16, 10.05), new THREE.MeshStandardMaterial({ color: 0x162c40, roughness: 0.85 }));
  base.position.y = -0.10; fullGroup.add(base);
  const grid = new THREE.GridHelper(10, 20, 0x536c86, 0x263d54); grid.position.y = .006; grid.material.transparent = true; grid.material.opacity = .38; fullGroup.add(grid);
  function label(text, x, y, z) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d'); g.fillStyle = '#c9dbef'; g.font = '24px system-ui'; g.textAlign = 'center'; g.fillText(text, 128, 42);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
    sprite.scale.set(4.6, 1.15, 1); sprite.position.set(x, y, z); fullGroup.add(sprite);
  }
  label('X (µm) → +60', 0, 0, 5.8); label('Y (µm) ↑ +60', -6, 0, 0);
  const marker = (color, radius) => { const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), new THREE.MeshBasicMaterial({ color, depthTest: false })); m.renderOrder = 2; fullGroup.add(m); return m; };
  const mainMarker = marker(0xff3df2, 0.09), probeMarker = marker(0xffffff, 0.075);
  probeMarker.visible = false;
  const pointAt = (m, x, y) => m.position.set(x / HALF * 5, surfaceHeight(st.sc.P(x, y)) + 0.09, -y / HALF * 5);
  const sceneHeading = h('span', null, '完整搜尋區 · 3D 功率地形');
  // Preserve the original linear Gaussian close-up as a separate, reusable mesh.
  const peakGeo = new THREE.PlaneGeometry(10, 10, 90, 90); peakGeo.rotateX(-Math.PI / 2);
  const peakColors = new Float32Array(peakGeo.attributes.position.count * 3), peakPos = peakGeo.attributes.position;
  const gaussian = (x, z) => Math.exp(-((x / 5 * 6) ** 2 + (z / 5 * 6) ** 2) / (2 * SIG * SIG));
  for (let i = 0; i < peakPos.count; i++) {
    const v = gaussian(peakPos.getX(i), peakPos.getZ(i)); peakPos.setY(i, v * 2.4);
    const c = parula(v); c.forEach((value, k) => { peakColors[i * 3 + k] = value / 255; });
  }
  peakGeo.setAttribute('color', new THREE.BufferAttribute(peakColors, 3)); peakGeo.computeVertexNormals();
  peakGroup.add(new THREE.Mesh(peakGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide })));
  const wireGeo = new THREE.WireframeGeometry(new THREE.PlaneGeometry(10, 10, 30, 30).rotateX(-Math.PI / 2));
  const wp = wireGeo.attributes.position;
  for (let i = 0; i < wp.count; i++) wp.setY(i, gaussian(wp.getX(i), wp.getZ(i)) * 2.4 + 0.01);
  peakGroup.add(new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 })));
  for (const [r, color] of [[SIG * Math.sqrt(-2 * Math.log(0.99)), 0xffffff], [SIG * Math.sqrt(-2 * Math.log(10 ** -0.1)), 0xff7a1a]]) {
    const points = Array.from({ length: 97 }, (_, i) => new THREE.Vector3(Math.cos(i / 96 * 2 * Math.PI) * r / 6 * 5, 0.01, Math.sin(i / 96 * 2 * Math.PI) * r / 6 * 5));
    peakGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color })));
  }
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const light = new THREE.DirectionalLight(0xffffff, 1.1); light.position.set(4, 10, 6); scene.add(light);
  const rim = new THREE.DirectionalLight(0x8cdaec, 0.65); rim.position.set(-6, 7, -4); scene.add(rim);
  const describe = () => {
    sceneHeading.textContent = st.mode === 'full' ? '完整搜尋區 · 3D 功率地形' : '原版主峰 · 高斯山峰特寫';
    renderer.domElement.title = st.mode === 'full' ? '3D 高度 ∝ P^0.1，保留平滑鐘形並放大弱峰；峰高與視覺寬度不代表原始功率或模場寬度。精確功率請點選右側熱圖。' : '主峰周圍 ±6 µm；高度為相對功率（線性）。';
  };
  function shape() {
    const pos = geo.attributes.position, col = geo.attributes.color, color = new THREE.Color();
    field = new Float32Array((N + 1) ** 2);
    const xs = Array.from({ length: N + 1 }, (_, i) => -HALF + i * (2 * HALF / N));
    const ys = Array.from({ length: N + 1 }, (_, j) => HALF - j * (2 * HALF / N));
    const powers = st.sc.sampleGrid(xs, ys);
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const k = j * (N + 1) + i;
      const power = powers[k], v = field[k] = colorLevel(power), c = terrainColor(v);
      // PlaneGeometry's first row has world Z=-5: positive model Y is -world Z.
      pos.setY(k, surfaceHeight(power));
      color.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);
      col.setXYZ(k, color.r, color.g, color.b);
    }
    pos.needsUpdate = true; col.needsUpdate = true; geo.computeBoundingSphere(); geo.computeVertexNormals();
    pointAt(mainMarker, ...st.sc.main); probeMarker.visible = false;
    describe();
  }
  const syncRotation = () => { rotateButton.textContent = ctl.autoRotate ? '暫停旋轉' : '自動旋轉'; rotateButton.setAttribute('aria-pressed', String(ctl.autoRotate)); };
  // Clear angular inertia before a preset so the top view remains exactly aligned with the map.
  const settleControls = () => { ctl.autoRotate = false; ctl.enableDamping = false; ctl.update(); ctl.enableDamping = true; };
  const view3D = () => { settleControls(); topView = false; ctl.target.set(0, st.mode === 'full' ? 1.6 : 1, 0); cam.position.set(...(st.mode === 'full' ? [9, 9, 15] : [12, 13, 15])); cam.zoom = 1; ctl.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches; syncRotation(); ctl.update(); fit3(); };
  const viewTop = () => { settleControls(); topView = true; syncRotation(); ctl.target.set(0, 0, 0); cam.position.set(0, 22, 0.001); cam.zoom = 1; ctl.update(); fit3(); };
  const modeButtons = ['full', 'peak'].map((mode, i) => h('button', {
    type: 'button', class: mode === st.mode ? 'on' : '', 'aria-pressed': String(mode === st.mode),
    onclick: () => {
      st.mode = mode; fullGroup.visible = mode === 'full'; peakGroup.visible = mode === 'peak';
      modeButtons.forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-pressed', String(k === i)); });
      renderer.domElement.setAttribute('aria-label', mode === 'full' ? '與右側熱圖同步的三維功率地形，可拖曳旋轉' : '原版主峰高斯山峰特寫，線性高度，可拖曳旋轉');
      describe(); view3D();
    },
  }, mode === 'full' ? '全域同步' : '原版主峰'));
  const rotateButton = h('button', { type: 'button', class: 'btn ghost', onclick: () => {
    if (topView) { view3D(); ctl.autoRotate = true; }
    else ctl.autoRotate = !ctl.autoRotate;
    syncRotation(); anim.start();
  } });
  syncRotation();
  const viewButtons = h('div', { class: 'row xy-view-buttons' },
    h('button', { type: 'button', class: 'btn ghost', onclick: view3D }, '立體視角'),
    h('button', { type: 'button', class: 'btn ghost', onclick: viewTop }, '俯視對照'), rotateButton);
  const fit3 = () => { const w = holder.clientWidth, H = holder.clientHeight; if (w < 2 || H < 2) return; renderer.setSize(w, H, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; const half = topView ? 6.5 : st.mode === 'full' ? 5.8 : 7; cam.left = -half * w / H; cam.right = half * w / H; cam.top = half; cam.bottom = -half; cam.updateProjectionMatrix(); if (body.closest('.slide').classList.contains('on')) anim.start(); };
  new ResizeObserver(fit3).observe(holder);
  const anim = loop((dt) => { const moved = ctl.update(dt); renderer.render(scene, cam); if (!ctl.autoRotate && !moved) anim.stop(); });
  ctl.addEventListener('change', () => { if (body.closest('.slide').classList.contains('on')) anim.start(); });

  // ---- 120×120 µm 地圖（dB） ----
  const cm = h('canvas'), M = fitCanvas(cm, () => drawMap());
  let mapImg = null, probe = null;
  const rd = h('div', { class: 'rd2', role: 'status', 'aria-live': 'polite' });
  function drawMap() {
    const { ctx, w, h: H } = M; if (!w) return;
    const sz = Math.min(w - 80, H - 30), ox = (w - sz - 12) / 2, oy = (H - sz) / 2, X = (x) => ox + ((x + HALF) / (2 * HALF)) * sz, Y = (y) => oy + ((HALF - y) / (2 * HALF)) * sz;
    if (!mapImg) { const n = N + 1, img = new ImageData(n, n);
      for (let k = 0; k < field.length; k++) writeFieldPixel(img.data, k * 4, field[k]);
      mapImg = document.createElement('canvas'); mapImg.width = n; mapImg.height = n; mapImg.getContext('2d').putImageData(img, 0, 0); }
    ctx.fillStyle = '#0b1426'; ctx.fillRect(0, 0, w, H);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(mapImg, ox, oy, sz, sz);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.strokeRect(ox, oy, sz, sz);
    ctx.font = '12px system-ui, "Microsoft JhengHei", sans-serif'; ctx.fillStyle = '#93a6c6'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const v of [-60, -30, 0, 30, 60]) { ctx.fillText(v, ox - 4, Y(v)); ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(v, X(v), oy + sz + 3); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; }
    // 色條
    for (let i = 0; i < sz; i++) { const c = terrainColor(1 - i / sz); ctx.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; ctx.fillRect(ox + sz + 6, oy + i, 8, 1.5); }
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
    pointAt(probeMarker, x, y); probeMarker.visible = true;
    anim.start();
    rd.innerHTML = `(${x.toFixed(1)}, ${y.toFixed(1)}) µm　功率 <b>${p >= 1e-4 ? (p * 100).toPrecision(3) + '%' : p.toExponential(1)}</b>（${(10 * Math.log10(Math.max(p, 1e-12))).toFixed(1)} dB）　離主峰 <b>${d.toFixed(1)} µm</b>`;
    drawMap();
  });

  const bNew = h('button', { type: 'button', class: 'btn ghost', onclick: () => { st.seed = (st.seed * 48271) % 2147483647; st.sc = makeScene(st.seed); mapImg = null; probe = null; shape(); rd.textContent = ''; drawMap(); renderer.render(scene, cam); } }, '換一組場景');
  const kpi = (v, l) => h('div', { class: 'kp' }, h('b', null, v), h('span', null, l));
  holder.append(h('div', { class: 'seg xy-modes', role: 'group', 'aria-label': '3D 顯示模式' }, modeButtons));
  const mapPane = pane(cm); mapPane.append(rd);

  body.append(h('div', { class: 'grid grow xy-layout' },
    h('div', { class: 'card dark col xy-peak' },
      h('div', { class: 'row xy-heading' }, sceneHeading, viewButtons),
      holder),
    h('div', { class: 'card dark col xy-map' },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { style: { color: '#fff', fontWeight: 700 } }, '整個搜尋區 120 × 120 µm（dB）'), bNew),
      mapPane),
    h('div', { class: 'xy-insights' },
      h('div', { class: 'card dark col xy-formula', style: { gap: '2px' } },
        h('div', { class: 'k-h' }, '主峰模型：二維高斯'),
        tex('P(x,y)=A\\,\\exp\\!\\left[-\\frac{(x-x_0)^2+(y-y_0)^2}{2\\sigma^2}\\right]'),
        tex('\\sigma=\\tfrac{1}{2}\\sqrt{w_1^2+w_2^2}', 'sm')),
      h('div', { class: 'kps xy-metrics' },
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
