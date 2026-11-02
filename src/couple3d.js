// 3D 光路場景：光纖 → （透鏡在第幾層）→ PIC。三種情況共用同一個高斯光束 w(z)（optics3.js）。
// 座標：x＝光軸（場景單位 = µm / 10），y 向上，z 橫向。光束粗細依 w(z) 放大 SHOW_W 倍顯示（示意）。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CASES, W_SSC, LAYER_NAMES } from './optics3.js';

const S = 0.1;            // µm → 場景單位
const R_CLAD = 62.5;      // 光纖包層半徑 µm
// 光束顯示半徑：細光束放大約 2 倍才看得到，粗光束壓縮，避免比透鏡還粗（示意，不是比例）
const showW = (w) => (w * 3.4) / (1 + w / 26);

export const C3D_CSS = `
.c3d { position:relative; overflow:hidden; border-radius:14px; background:#050a14; }
.c3d canvas { display:block; }
.c3d .lbls { position:absolute; inset:0; pointer-events:none; }
.c3l { font: 600 14px var(--font); color:#e8f1ff; background:rgba(10,20,38,.72); border:1px solid rgba(140,180,255,.35); padding:3px 10px; border-radius:99px; white-space:nowrap; backdrop-filter: blur(4px); }
.c3l.lens { color:#fff2d6; border-color:rgba(255,190,90,.75); background:rgba(70,40,5,.72); }
.c3l.waist { color:#ffd5b0; border-color:rgba(255,140,60,.6); }
.c3l.chip { color:#bfe8ff; border-color:rgba(80,190,255,.6); }
.c3l.dim { opacity:.75; font-weight:500; font-size:13px; }
.c3l.layer { font-size:13px; color:#9fb4d6; background:rgba(8,14,28,.6); border-color:rgba(120,150,200,.25); }
.c3l.layer.on { color:#fff; border-color:#ffb86b; background:rgba(120,60,10,.75); }
`;

function tubeGeometry(xs, rs, intens, radial = 40) {
  const n = xs.length, pos = new Float32Array(n * radial * 3), nor = new Float32Array(n * radial * 3), ai = new Float32Array(n * radial), ax = new Float32Array(n * radial);
  const idx = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), k = i * radial + j;
      pos.set([xs[i], rs[i] * c, rs[i] * s], k * 3); nor.set([0, c, s], k * 3); ai[k] = intens[i]; ax[k] = xs[i];
      if (i < n - 1) { const a0 = k, a1 = i * radial + ((j + 1) % radial), b0 = a0 + radial, b1 = a1 + radial; idx.push(a0, b0, a1, a1, b0, b1); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('aI', new THREE.BufferAttribute(ai, 1)); g.setAttribute('aX', new THREE.BufferAttribute(ax, 1));
  g.setIndex(idx);
  return g;
}

const beamVS = `
attribute float aI; attribute float aX; varying float vI; varying float vX; varying vec3 vN; varying vec3 vV;
void main(){ vI=aI; vX=aX; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`;
const beamFS = `
uniform vec3 uColor; uniform float uGain; uniform float uT; uniform float uFront; uniform float uPulse;
varying float vI; varying float vX; varying vec3 vN; varying vec3 vV;
void main(){
  if (vX > uFront) discard;
  float facing = abs(dot(normalize(vN), normalize(vV)));
  float core = pow(facing, 2.2);
  float wave = 1.0 - uPulse + uPulse * (0.5 + 0.5 * sin(vX * 0.55 - uT * 7.0));
  float edge = smoothstep(uFront, uFront - 4.0, vX);
  gl_FragColor = vec4(uColor * (uGain * vI * core * wave * edge), 1.0);
}`;

// ---- 高畫質模式（hq，只用在 ③ 三種透鏡放法頁；封面維持原樣）用的小工具 ----
// 柔和的圓形光點貼圖（光子、焦點光暈、波導脈衝共用）
function glowTex(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,200,140,.35)') {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.25, mid); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// 晶片表面的電路紋路（示意）
function circuitTex() {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 512);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.lineCap = 'round';
  for (let k = 0; k < 90; k++) {
    let x = rnd() * 1024, y = rnd() * 512; g.strokeStyle = `rgba(80,200,255,${0.25 + 0.5 * rnd()})`; g.lineWidth = 1 + 2 * rnd(); g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 5; s++) { if (rnd() < 0.5) x += (rnd() - 0.5) * 300; else y += (rnd() - 0.5) * 160; g.lineTo(x, y); }
    g.stroke(); g.fillStyle = 'rgba(140,230,255,.8)'; g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// 發光格線地板：格線往遠處淡出
const floorVS = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const floorFS = `uniform vec3 uC; uniform float uT; uniform vec2 uO; varying vec3 vW;
float line(float v, float s){ float f = abs(fract(v / s - 0.5) - 0.5) * s; return 1.0 - smoothstep(0.0, fwidth(v) * 1.2, f); }
void main(){ float d = length(vW.xz - uO); float fade = exp(-d * 0.012);
  float g = max(line(vW.x, 10.0), line(vW.z, 10.0)) * 0.55 + max(line(vW.x, 50.0), line(vW.z, 50.0)) * 0.9;
  float scan = 0.5 + 0.5 * sin(d * 0.08 - uT * 1.6);
  gl_FragColor = vec4(uC * g * fade * (0.55 + 0.45 * scan), 1.0); }`;
// 畫面暗角
const vignetteShader = {
  uniforms: { tDiffuse: { value: null }, uAmt: { value: 1.1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uAmt; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); float d = distance(vUv, vec2(0.5)); c.rgb *= mix(1.0, smoothstep(0.85, 0.2, d * uAmt), 0.85); gl_FragColor = c; }`,
};

function lathe(profile, mat, seg = 64) {
  // profile：[[r, x], ...]（µm）→ 繞 x 軸旋轉
  const g = new THREE.LatheGeometry(profile.map(([r, x]) => new THREE.Vector2(r * S, x * S)), seg);
  g.rotateZ(-Math.PI / 2);
  return new THREE.Mesh(g, mat);
}

export class Couple3D {
  constructor(holder, { caseId = 'lensed', auto = false, onCase, shift = 0, layers = true, hq = false } = {}) {
    this.holder = holder; this.auto = auto; this.onCase = onCase; this.shift = shift; this.layers = layers; this.hq = hq;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.95;
    holder.append(r.domElement);
    this.lbl = new CSS2DRenderer(); this.lbl.domElement.className = 'lbls'; holder.append(this.lbl.domElement);
    const sc = (this.scene = new THREE.Scene());
    sc.background = new THREE.Color(0x050a14);
    sc.fog = new THREE.Fog(0x050a14, 140, 420);
    sc.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
    sc.environmentIntensity = 0.45;
    sc.add(new THREE.HemisphereLight(0x9fc3ff, 0x0a0f1c, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(30, 80, 60); sc.add(key);
    const rim = new THREE.DirectionalLight(0x6aa8ff, 1.2); rim.position.set(-60, 30, -80); sc.add(rim);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.5, 2000);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08; this.controls.minDistance = 8; this.controls.maxDistance = 300;
    this.controls.addEventListener('start', () => { this.userCam = true; this.fly = null; });
    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(sc, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.45, 0.62);
    this.composer.addPass(this.bloom);
    if (hq) { this.bloom.strength = 1.0; this.bloom.radius = 0.55; this.bloom.threshold = 0.72; this.composer.addPass(new ShaderPass(vignetteShader)); }
    this.composer.addPass(new OutputPass());
    this.grid();
    this.group = new THREE.Group(); sc.add(this.group);
    this.t = 0; this.front = -9999; this.on = false;
    this.setCase(caseId, true);
    r.compileAsync(sc, this.camera).catch(() => {});   // 背景平行編譯著色器（配合封面預載）
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(holder);
    this.onScale = () => this.resize(); window.addEventListener('deckscale', this.onScale);
    this.resize();
  }

  grid() {
    // 光學桌面般的暗色格線與粒子（hq：會發光、往遠處淡出、有掃描波紋的格線地板）
    if (this.hq) {
      this.floorMat = new THREE.ShaderMaterial({ vertexShader: floorVS, fragmentShader: floorFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uC: { value: new THREE.Color(0x2a6fd0) }, uT: { value: 0 }, uO: { value: new THREE.Vector2(0, 0) } } });
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), this.floorMat); fl.rotation.x = -Math.PI / 2; fl.position.y = -32; this.scene.add(fl);
    } else { const g = new THREE.GridHelper(900, 90, 0x1d3356, 0x0f1c33); g.position.y = -32; g.material.transparent = true; g.material.opacity = 0.55; this.scene.add(g); }
    const N = 500, p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) p.set([(Math.random() - 0.4) * 500, Math.random() * 120 - 30, (Math.random() - 0.5) * 300], i * 3);
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x4f7dbb, size: 0.35, transparent: true, opacity: 0.5, depthWrite: false }));
    this.scene.add(this.dust);
  }

  label(text, cls, pos) {
    const el = document.createElement('div'); el.className = 'c3l ' + (cls || ''); el.textContent = text;
    const o = new CSS2DObject(el); o.position.copy(pos); this.group.add(o); return o;
  }

  clear() {
    for (const o of [...this.group.children]) {
      this.group.remove(o);
      o.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material && !m.material.shared) m.material.dispose(); if (m.element) m.element.remove(); });
    }
  }

  setCase(id, instant = false) {
    this.caseId = id; const c = (this.c = CASES[id]);
    this.clear();
    const G = this.group, V = (x, y = 0, z = 0) => new THREE.Vector3(x * S, y * S, z * S);
    const glass = this.hq
      ? new THREE.MeshPhysicalMaterial({ color: 0xd6e8ff, metalness: 0, roughness: 0.04, transmission: 1, thickness: 3, ior: 1.45, attenuationColor: new THREE.Color(0x8fb8ff), attenuationDistance: 40, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.1, transparent: true, opacity: 0.55, depthWrite: false })
      : new THREE.MeshPhysicalMaterial({ color: 0x6f9bd6, metalness: 0, roughness: 0.12, transparent: true, opacity: 0.16, clearcoat: 0.4, envMapIntensity: 0.25, side: THREE.DoubleSide, depthWrite: false });
    const lensMat = new THREE.MeshPhysicalMaterial({ color: 0xd9b87a, metalness: 0, roughness: 0.1, transparent: true, opacity: 0.32, clearcoat: 0.5, envMapIntensity: 0.3, side: THREE.DoubleSide, depthWrite: false, emissive: 0x6b3a00, emissiveIntensity: 0.25 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x9aa6b8, metalness: 0.85, roughness: 0.28 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b2230, metalness: 0.6, roughness: 0.45 });

    // ---- 光纖 ----
    const fLen = 900;
    const prof = [];
    if (id === 'lensed') {
      const tipR = 30;
      prof.push([0, -fLen], [R_CLAD, -fLen], [R_CLAD, -c.taper - 60]);
      for (let k = 0; k <= 20; k++) { const u = k / 20; prof.push([R_CLAD + (tipR - R_CLAD) * (u * u * (3 - 2 * u)), -c.taper - 60 + u * (c.taper + 60 - tipR * 0.55)]); }
      for (let k = 1; k <= 16; k++) { const a = (k / 16) * (Math.PI / 2); prof.push([tipR * Math.cos(a), -tipR * 0.55 + tipR * 0.55 * Math.sin(a)]); }
    } else prof.push([0, -fLen], [R_CLAD, -fLen], [R_CLAD, 0], [0, 0]);
    G.add(lathe(prof, glass));
    // 塗覆層與夾具
    G.add(lathe([[0, -fLen - 400], [125, -fLen - 400], [125, -fLen + 120], [R_CLAD + 2, -fLen + 120]], new THREE.MeshStandardMaterial({ color: 0x2f6fd6, roughness: 0.5, metalness: 0.1 })));
    const vg = new THREE.Mesh(new THREE.BoxGeometry(420 * S, 60 * S, 260 * S), metal); vg.position.set((-fLen + 150) * S, -92 * S, 0); G.add(vg);
    const vg2 = new THREE.Mesh(new THREE.BoxGeometry(420 * S, 210 * S, 260 * S), dark); vg2.position.set((-fLen + 150) * S, -225 * S, 0); G.add(vg2);
    // 纖芯（淡光）
    const coreG = new THREE.CylinderGeometry(4.1 * S, 4.1 * S, (fLen - (id === 'lensed' ? c.taper : 0)) * S, 24); coreG.rotateZ(Math.PI / 2);
    const core = new THREE.Mesh(coreG, new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.35, depthWrite: false }));
    core.position.x = (-(fLen + (id === 'lensed' ? c.taper : 0)) / 2) * S; G.add(core);

    // ---- 透鏡 ----
    let lensPos;
    if (id === 'freelens') {
      const R = 80, sag = 26;
      const lp = []; for (let k = 0; k <= 24; k++) { const r = (R * k) / 24; lp.push([r, c.lensZ - sag * (1 - (r / R) ** 2)]); }
      for (let k = 24; k >= 0; k--) { const r = (R * k) / 24; lp.push([r, c.lensZ + sag * (1 - (r / R) ** 2)]); }
      G.add(lathe(lp, lensMat));
      const ringG = new THREE.TorusGeometry(R * S + 0.9, 1.3, 16, 64); ringG.rotateY(Math.PI / 2);
      const ring = new THREE.Mesh(ringG, metal); ring.position.x = c.lensZ * S; G.add(ring);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 200 * S, 24), metal); post.position.set(c.lensZ * S, -(R + 100) * S, 0); G.add(post);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 1.2, 32), dark); base.position.set(c.lensZ * S, -31.4, 0); G.add(base);
      lensPos = V(c.lensZ + 40, -(R + 70));
    }
    // ---- 晶片 ----
    const L = 900, W = 520;
    const chip = new THREE.Group(); chip.position.x = c.zc * S; G.add(chip);
    const box = (w, hgt, d, mat, x, y, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w * S, hgt * S, d * S), mat); m.position.set(x * S, y * S, z * S); chip.add(m); return m; };
    const hq = this.hq;
    box(L, 260, W, hq ? new THREE.MeshPhysicalMaterial({ color: 0x161c28, metalness: 0.85, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.15 }) : new THREE.MeshStandardMaterial({ color: 0x2c3240, metalness: 0.7, roughness: 0.32 }), L / 2, -150);          // 矽基板
    box(L, 18, W, new THREE.MeshStandardMaterial({ color: hq ? 0x2a3854 : 0x5a6c88, metalness: 0.2, roughness: 0.3, transparent: true, opacity: 0.85 }), L / 2, -11);  // BOX
    box(L, 24, W, new THREE.MeshPhysicalMaterial({ color: 0x9fd0ff, roughness: 0.08, transparent: true, opacity: hq ? 0.05 : 0.09, clearcoat: 0.3, envMapIntensity: hq ? 0.15 : 0.3, depthWrite: false }), L / 2, 10);  // 上包層
    // 波導：SSC（反錐形）→ 單模波導 → 微環
    const wgMat = (this.wgMat = new THREE.MeshStandardMaterial({ color: 0x0d3b5c, emissive: 0x29b6ff, emissiveIntensity: 0.15, roughness: 0.3 }));
    const ssc = new THREE.Mesh(new THREE.BoxGeometry(260 * S, 2.6 * S, 1 * S), wgMat); ssc.geometry.translate(130 * S, 0, 0);
    { const pos = ssc.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { const u = pos.getX(i) / (260 * S); pos.setZ(i, pos.getZ(i) * (0.6 + 4.4 * u)); } pos.needsUpdate = true; }
    ssc.position.x = (id === 'chiplens' ? c.zWaist - c.zc : 0) * S; chip.add(ssc);
    const wgL = L - 260 - (id === 'chiplens' ? c.zWaist - c.zc : 0);
    box(wgL, 2.6, 5, wgMat, 260 + (id === 'chiplens' ? c.zWaist - c.zc : 0) + wgL / 2, 0);
    const ringR = 70, ringC = new THREE.Mesh(new THREE.TorusGeometry(ringR * S, 0.45, 12, 96), wgMat); ringC.rotation.x = Math.PI / 2; ringC.position.set(600 * S, 0, (ringR + 6) * S); chip.add(ringC);
    // 金屬電極（裝飾）
    for (const [x, z] of [[480, -150], [560, -150], [640, -150], [720, -150]]) box(50, 4, 50, new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 1, roughness: 0.25 }), x, 24, z);
    if (id === 'chiplens') {
      const R = 46, sag = 18, lp = [];
      for (let k = 0; k <= 24; k++) { const r = (R * k) / 24; lp.push([r, c.zc - sag * (1 - (r / R) ** 2)]); }
      lp.push([0, c.zc]);
      G.add(lathe(lp, lensMat));
      lensPos = V(c.zc - 30, -(R + 40));
    }
    if (id === 'lensed') lensPos = V(-20, 40);

    // ---- 光束 ----
    const x0 = -fLen * 0.75, x1 = c.zc + 520;
    const xs = [], ws = [];
    for (let z = x0; z <= x1; z += z < -c.zc - 40 ? 12 : 1.2) { xs.push(z); ws.push(c.w(z)); }
    const wMin = Math.min(...ws);
    const inten = ws.map((w, i) => { const base = Math.min(2.2, (wMin / w) ** 1.25 * 1.4); return xs[i] < 0 ? base * 0.55 : xs[i] > c.zWaist ? base * 0.32 : base; });
    this.beamMats = [];
    for (const [k, gain, col] of [[0.55, 1.6, 0xffe0b0], [1.0, 0.9, 0xff8a2a], [1.7, 0.35, 0xff5a10]]) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: beamVS, fragmentShader: beamFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Color(col) }, uGain: { value: gain }, uT: { value: 0 }, uFront: { value: -1e4 }, uPulse: { value: 0.35 } },
      });
      this.beamMats.push(mat);
      G.add(new THREE.Mesh(tubeGeometry(xs.map((x) => x * S), ws.map((w) => Math.max(0.12, showW(w) * k * S)), inten), mat));
    }
    // 光腰標記
    const wr = new THREE.Mesh(new THREE.TorusGeometry(showW(W_SSC) * 1.9 * S, 0.06, 8, 48), new THREE.MeshBasicMaterial({ color: 0xffd0a0 }));
    wr.rotation.y = Math.PI / 2; wr.position.x = c.zWaist * S; G.add(wr);

    if (this.hq) this.buildFX(c, chip, L, x0, x1);

    // ---- 層位面板（第 1、2、3 層）----
    const planes = [[0, 1], [id === 'freelens' ? c.lensZ : (c.zc * 0.5), 2], [c.zc, 3]];
    this.layerLbl = [];
    for (const [x, n] of this.layers ? planes : []) {   // 封面不畫層位面板
      const on = n === c.layer;
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(220 * S, 200 * S), new THREE.MeshBasicMaterial({ color: on ? 0xffa040 : 0x5d86c8, transparent: true, opacity: on ? 0.13 : 0.045, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      pm.rotation.y = Math.PI / 2; pm.position.set(x * S + (n === 3 ? -0.4 : n === 1 ? 0.4 : 0), 0, 0); G.add(pm);
      const ed = new THREE.LineSegments(new THREE.EdgesGeometry(pm.geometry), new THREE.LineBasicMaterial({ color: on ? 0xffb060 : 0x3f6aa8, transparent: true, opacity: on ? 0.9 : 0.35 }));
      ed.rotation.copy(pm.rotation); ed.position.copy(pm.position); G.add(ed);
      this.layerLbl.push(this.label(LAYER_NAMES[n - 1], 'layer' + (on ? ' on' : ''), V(x, [175, 135, 95][n - 1])));
    }
    // ---- 標籤 ----
    this.label(id === 'lensed' ? '透鏡光纖' : '一般光纖（平切）', 'dim', V(this.layers ? -200 : -520, 90));
    if (lensPos) this.label('透鏡：' + c.lensName, 'lens', lensPos);
    this.label(`光腰 ≈ ${(2 * W_SSC).toFixed(0)} µm`, 'waist', V(c.zWaist, -34));
    this.label('PIC 晶片：SSC → 波導', 'chip', V(c.zc + (this.layers ? 180 : 330), 60));

    // ---- 鏡頭 ----
    const dist = (c.zc + 640) * S * (this.layers ? 1.3 : 0.95), cx = c.zc * 0.5 * S - this.shift * dist;
    this.home = { pos: new THREE.Vector3(cx - dist * 0.22, dist * 0.36, dist * 0.92), tgt: new THREE.Vector3(cx, -1.5, 0) };
    if (instant) { this.camera.position.copy(this.home.pos); this.controls.target.copy(this.home.tgt); }
    else this.flyTo(this.home.pos, this.home.tgt);
    this.userCam = false;
    this.replay();
    this.onCase && this.onCase(id);
  }

  // hq 特效：沿光路流動的光子、光腰焦點光暈、晶片電路紋、波導裡往前跑的光脈衝
  buildFX(c, chip, L, x0, x1) {
    const G = this.group, tex = (this.glowT = this.glowT || glowTex());
    // 光子：每顆有自己的位置比例 u、角度與半徑比例；位置每格依 w(z) 更新
    const N = 900, pos = new Float32Array(N * 3);
    this.ph = Array.from({ length: N }, () => ({ u: Math.random(), a: Math.random() * Math.PI * 2, k: Math.sqrt(Math.random()) * 0.85, v: 0.8 + 0.4 * Math.random() }));
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.phPts = new THREE.Points(pg, new THREE.PointsMaterial({ map: tex, color: 0xffb070, size: 1.1, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.phPts.frustumCulled = false; G.add(this.phPts); this.phX = [x0, x1];
    // 光腰焦點光暈
    this.flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffd2a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    this.flare.position.set(c.zWaist * S, 0, 0); this.flare.scale.setScalar(9); G.add(this.flare);
    // 晶片表面電路紋（上包層頂面，示意）
    const ct = (this.circT = this.circT || circuitTex());
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(L * S, 520 * S), new THREE.MeshBasicMaterial({ map: ct, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    plate.rotation.x = -Math.PI / 2; plate.position.set((L / 2) * S, 22.5 * S, 0); chip.add(plate); this.plateMat = plate.material;
    // 波導光脈衝
    this.pulses = Array.from({ length: 5 }, (_, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x7fe0ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); s.scale.setScalar(3.2); s.userData.u = i / 5; chip.add(s); return s; });
    this.chipL = L;
  }

  // hq 特效每格更新
  stepFX(dt, lit) {
    const c = this.c, [x0, x1] = this.phX, P = this.phPts.geometry.attributes.position, arr = P.array;
    for (let i = 0; i < this.ph.length; i++) {
      const q = this.ph[i]; q.u = (q.u + dt * 0.11 * q.v) % 1;
      const x = x0 + (x1 - x0) * q.u, xs = x * S;
      if (xs > this.front) { arr[i * 3] = 0; arr[i * 3 + 1] = -9999; arr[i * 3 + 2] = 0; continue; }
      const r = showW(c.w(x)) * q.k * S;
      arr[i * 3] = xs; arr[i * 3 + 1] = r * Math.cos(q.a + this.t * 0.6); arr[i * 3 + 2] = r * Math.sin(q.a + this.t * 0.6);
    }
    P.needsUpdate = true;
    const atWaist = this.front > c.zWaist * S;
    this.flare.material.opacity += ((atWaist ? 0.85 + 0.15 * Math.sin(this.t * 4) : 0) - this.flare.material.opacity) * Math.min(1, dt * 5);
    this.flare.scale.setScalar(7 + 1.5 * Math.sin(this.t * 2.2));
    this.plateMat.opacity = 0.35 + (lit ? 0.25 : 0) + 0.08 * Math.sin(this.t * 1.3);
    for (const s of this.pulses) {
      s.userData.u = (s.userData.u + dt * 0.18) % 1;
      s.position.set(s.userData.u * this.chipL * S, 0, 0);
      s.material.opacity += ((lit ? 0.9 * Math.sin(Math.PI * s.userData.u) : 0) - s.material.opacity) * Math.min(1, dt * 6);
    }
    if (this.floorMat) { this.floorMat.uniforms.uT.value = this.t; this.floorMat.uniforms.uO.value.set(this.controls.target.x, this.controls.target.z); }
  }

  flyTo(p, t, ms = 1100) { this.fly = { p0: this.camera.position.clone(), t0: this.controls.target.clone(), p1: p.clone(), t1: t.clone(), s: performance.now(), ms }; }
  // 光從光纖裡出發、一路走進晶片
  replay() { this.front = -900 * 0.75 * S; this.wgMat.emissiveIntensity = 0.15; }

  resize() {
    const w = this.holder.clientWidth, hgt = this.holder.clientHeight;
    if (w < 2 || hgt < 2) return;
    const dpr = Math.min(2, (window.devicePixelRatio || 1) * (window.__deckScale || 1));
    this.renderer.setPixelRatio(dpr); this.renderer.setSize(w, hgt, false);
    this.renderer.domElement.style.width = w + 'px'; this.renderer.domElement.style.height = hgt + 'px';
    this.composer.setPixelRatio(dpr); this.composer.setSize(w, hgt);
    this.lbl.setSize(w, hgt);
    this.camera.aspect = w / hgt; this.camera.updateProjectionMatrix();
  }

  frame(dt) {
    this.t += dt;
    const c = this.c, end = (c.zc + 520) * S;
    if (this.front < end) this.front += dt * (this.front < 0 ? 70 : 32);
    for (const m of this.beamMats) { m.uniforms.uT.value = this.t; m.uniforms.uFront.value = this.front; }
    const lit = this.front > (c.zWaist + 40) * S;
    this.wgMat.emissiveIntensity += ((lit ? 2.4 + 0.4 * Math.sin(this.t * 3) : 0.15) - this.wgMat.emissiveIntensity) * Math.min(1, dt * 4);
    if (this.hq && this.ph) this.stepFX(dt, lit);
    if (this.fly) {
      const k = Math.min((performance.now() - this.fly.s) / this.fly.ms, 1), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.camera.position.lerpVectors(this.fly.p0, this.fly.p1, e); this.controls.target.lerpVectors(this.fly.t0, this.fly.t1, e);
      if (k >= 1) { this.fly = null; this.swayT = 0; }
    } else if (!this.userCam) {
      // 緩慢擺動，讓立體感出來（從 0 開始，接續飛行結束的位置）
      this.swayT = (this.swayT || 0) + dt;
      const a = Math.sin(this.swayT * 0.25) * 0.35, tg = this.home.tgt, p = this.home.pos.clone().sub(tg);
      const r = Math.hypot(p.x - 0, p.z), ang0 = Math.atan2(p.x, p.z);
      this.camera.position.set(tg.x + r * Math.sin(ang0 + a), tg.y + p.y, tg.z + r * Math.cos(ang0 + a));
      this.controls.target.copy(tg);
    }
    this.dust.rotation.y += dt * 0.01;
    this.controls.update();
    this.composer.render();
    this.lbl.render(this.scene, this.camera);
  }

  start() {
    if (this.on) return; this.on = true; this.resize();
    let last = performance.now();
    const tick = (now) => { if (!this.on) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; this.frame(dt); this.raf = requestAnimationFrame(tick); };
    this.raf = requestAnimationFrame(tick);
  }
  stop() { this.on = false; cancelAnimationFrame(this.raf); }
  resetView() { this.userCam = false; this.flyTo(this.home.pos, this.home.tgt); }
}
