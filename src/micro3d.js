// ⑤ 第 3 頁「化身光纖」：真實比例（µm）的光纖尖端與 PIC 端面。預設鏡頭跟在光纖後上方（第一人稱），可切旁觀（可拖曳）；對準後畫出光沿波導送進晶片。
// 座標同 pov3d：x＝光軸（晶片端面 x=0，晶片在 x>0），y＝垂直（Y），z＝水平（X）。光纖尖端在 (−間距, dy, dx)。
// 光纖用平切單模光纖（模場半徑 = 進度報告模擬的 w0），因為精對位軌跡就是那次光纖對光纖的模擬。
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { beamAt } from './physics.js';
import { studioEnv } from './studio-env.js';
import { createMicroBeam } from './micro-beam.js';

function lathe(profile, mat, seg = 64) {
  const g = new THREE.LatheGeometry(profile.map(([r, x]) => new THREE.Vector2(r, x)), seg);
  g.rotateZ(-Math.PI / 2);
  return new THREE.Mesh(g, mat);
}
function glowTex(r, g, b) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, `rgba(${r},${g},${b},.9)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class Micro3D {
  constructor(holder, w0) {
    this.p = { wf: w0, WD: 0 };
    this.holder = holder;
    const sc = (this.scene = new THREE.Scene());
    sc.background = new THREE.Color(0x18232f);
    sc.add(new THREE.HemisphereLight(0xdce8f3, 0x18202b, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(-1, 2, 1.5); sc.add(key);
    const rim = new THREE.DirectionalLight(0xc3d8ef, 0.9); rim.position.set(2, 1, -3); sc.add(rim);
    const r = (this.r = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true }));
    r.toneMapping = THREE.ACESFilmicToneMapping; holder.prepend(r.domElement);
    // 環境反射：晶片拋光面、氧化層與玻璃光纖靠它才有真實的反光
    sc.environment = studioEnv(r);
    this.cam = new THREE.PerspectiveCamera(40, 1, 0.05, 5e5);
    this.cam.position.set(-120, 90, 160);
    this.ctl = new OrbitControls(this.cam, r.domElement); this.ctl.enableDamping = true; this.ctl.enablePan = false; this.ctl.enableZoom = false;
    this.dist = 200;

    // ---- PIC 晶片 ----
    const chip = new THREE.Group(); sc.add(chip);
    const box = (w, hh, d, mat, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), mat); m.position.set(x, y, 0); chip.add(m); return m; };
    // 矽基板（拋光、帶金屬感的深灰）→ 埋氧層 → 上包層氧化矽（薄膜干涉的彩色光澤，真實晶片在斜角下就是這樣）
    box(3000, 700, 5000, new THREE.MeshPhysicalMaterial({ color: 0x343b46, metalness: 0.6, roughness: 0.28, clearcoat: 0.25, emissive: 0x1a2537, emissiveIntensity: 0.15 }), 1500, -356);
    box(3000, 5, 5000, new THREE.MeshStandardMaterial({ color: 0x8ea6c6, metalness: 0.05, roughness: 0.45, emissive: 0x1b2f4c, emissiveIntensity: 0.7 }), 1500, -3.5);
    box(3000, 12, 5000, new THREE.MeshPhysicalMaterial({ color: 0x34435b, roughness: 0.32, transparent: true, opacity: 0.48, depthWrite: false, emissive: 0x172a4a, emissiveIntensity: 0.08,
      iridescence: .35, iridescenceIOR: 1.46, iridescenceThicknessRange: [420, 1150] }), 1500, 5);
    // 晶片上的金屬：遠端的金焊墊、側邊波導上的加熱器（不擋中間那條波導的光）
    const gold = new THREE.MeshStandardMaterial({ color: 0xd9ab52, metalness: 1, roughness: 0.28 });
    const heater = new THREE.MeshStandardMaterial({ color: 0x9aa1ab, metalness: 0.9, roughness: 0.35 });
    for (const s of [-1, 1]) for (let i = 0; i < 8; i++) box(90, 1.2, 90, gold, 1700 + i * 140, 11.6).position.z = s * 2050;
    for (const k of [-2, 2]) box(700, 0.6, 10, heater, 1500, 11.3).position.z = k * 127;
    // 鏡頭幾乎貼著晶片表面看（掠射角），反射要壓低才不會整片發白；scene.environment 會蓋掉材質自己的強度，所以這三層各自掛環境貼圖
    chip.children.slice(0, 3).forEach((m, i) => { m.material.envMap = sc.environment; m.material.envMapIntensity = [0.25, 0.18, 0.12][i]; });
    this.wgMat = new THREE.MeshStandardMaterial({ color: 0x0b2a40, emissive: 0x29b6ff, emissiveIntensity: 1.2 });
    const wg = new THREE.Mesh(new THREE.BoxGeometry(3000, 3, 3), this.wgMat); wg.position.set(1500 - 0.02, 0, 0); chip.add(wg);
    for (const k of [-2, -1, 1, 2]) { const e = new THREE.Mesh(new THREE.BoxGeometry(3000, 3, 3), new THREE.MeshStandardMaterial({ color: 0x0b2a40, emissive: 0x1c6f9a, emissiveIntensity: 0.4 })); e.position.set(1500, 0, k * 127); chip.add(e); }
    // 光送進 PIC：波導裡往前推進的亮段、最前端的光點、沿光路流動的光脈衝
    this.wgLen = 900;
    this.wgLit = new THREE.Mesh(new THREE.BoxGeometry(1, 3.4, 3.4), new THREE.MeshBasicMaterial({ color: 0xff7a1a, toneMapped: false })); this.wgLit.visible = false; sc.add(this.wgLit);
    const pulseTexture = glowTex(255, 170, 80);
    const add = () => new THREE.SpriteMaterial({ map: pulseTexture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    this.front = new THREE.Sprite(add()); this.front.visible = false; sc.add(this.front);
    this.pulses = Array.from({ length: 16 }, () => { const s = new THREE.Sprite(add()); s.visible = false; sc.add(s); return s; });

    // ---- 平切單模光纖（125 µm 包層、8.2 µm 幾何纖芯；模場尺寸由 w0 決定）----
    this.fiber = new THREE.Group(); sc.add(this.fiber);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xd3e2ed, roughness: 0.08, transparent: true, opacity: 0.44, clearcoat: 1, ior: 1.45, specularIntensity: 1, envMapIntensity: 1.25 });
    this.fiber.add(lathe([[0, -9000], [62.5, -9000], [62.5, 0], [0, 0]], glass));
    const coreG = new THREE.CylinderGeometry(4.1, 4.1, 9000, 24); coreG.rotateZ(Math.PI / 2);
    const core = new THREE.Mesh(coreG, new THREE.MeshBasicMaterial({ color: 0xff8a3d })); core.position.x = -4500.2; this.fiber.add(core);
    const lg = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(255, 140, 60), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    lg.scale.set(26, 26, 1); this.fiber.add(lg);

    // ---- 光束、端面光點、軌跡 ----
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false });
    this.beamMesh = createMicroBeam();
    this.beam = new THREE.Mesh(this.beamMesh.geometry, this.beamMat); sc.add(this.beam);
    this.spot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(255, 120, 40), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sc.add(this.spot);
    this.trailN = 0; this.trailPos = new Float32Array(3 * 4000);
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3)); tg.setDrawRange(0, 0);
    this.trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0x7fb2ff, transparent: true, opacity: 0.9 })); sc.add(this.trail);

    this.quality = 'auto'; this.lastMotion = 0; this.lastDrawKey = '';
    this.ctl.addEventListener('change', () => this.onInvalidate?.());
    r.compileAsync(sc, this.cam).catch(() => {});   // 背景平行編譯著色器，第一次顯示不必卡住編譯
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(holder);
    this.onScale = () => this.resize(); window.addEventListener('deckscale', this.onScale);
    this.resize();
  }
  resize() {
    const w = this.holder.clientWidth, h = this.holder.clientHeight; if (w < 2 || h < 2) return;
    if (w === this.w && h === this.h) { this.lastDrawKey = ''; this.onInvalidate?.(); return; }
    this.r.setSize(w, h, false); this.r.domElement.style.width = w + 'px'; this.r.domElement.style.height = h + 'px';
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); this.w = w; this.h = h;
    this.lastDrawKey = ''; this.onInvalidate?.();
  }
  setQuality(value) { this.quality = value; this.lastDrawKey = ''; this.onInvalidate?.(); }
  get needsFrame() { return this.cameraSettling || performance.now() - this.lastMotion < 250; }
  // 軌跡：清空／加點（µm 世界座標）
  clearTrail() { this.trailN = 0; this.trail.geometry.setDrawRange(0, 0); }
  addTrail(v) {
    if (this.trailN >= 4000) return; const i = this.trailN * 3;
    if (this.trailN > 0 && Math.hypot(v.x - this.trailPos[i - 3], v.y - this.trailPos[i - 2], v.z - this.trailPos[i - 1]) < 0.05) return;
    this.trailPos.set([v.x, v.y, v.z], i); this.trailN++;
    this.trail.geometry.attributes.position.needsUpdate = true; this.trail.geometry.setDrawRange(0, this.trailN);
  }
  // pose：{dx, dy, gap, tx, ty, tz}（µm、rad）；power 0–1（無光＝0）
  // o：{ mode:'chase'|'orbit', fin：光送進 PIC 的進度 0–1, time：真實秒數（光脈衝流動用） }
  update(pose, power, o = {}) {
    const T = new THREE.Vector3(-pose.gap, pose.dy, pose.dx);
    this.fiber.position.copy(T); this.fiber.rotation.set(pose.tz || 0, -pose.tx, pose.ty, 'YZX'); this.fiber.updateMatrixWorld();
    const d = new THREE.Vector3(1, 0, 0).applyQuaternion(this.fiber.quaternion);
    const L = pose.gap / Math.max(0.2, d.x);
    if (L !== this.beamL) { this.beamMesh.update(L, this.p); this.beamL = L; }
    this.beam.position.copy(T); this.beam.quaternion.copy(this.fiber.quaternion);
    const H =T.clone().add(d.clone().multiplyScalar(L)); H.x = -0.4;
    const wf = beamAt(this.p, pose.gap).w;
    this.spot.position.copy(H); this.spot.scale.set(4 * wf, 4 * wf, 1); this.spot.material.opacity = Math.min(1, 0.3 + 2.5 * (this.p.wf / wf) ** 2);
    this.wgMat.emissiveIntensity = 0.45 + 2.5 * power;
    // ---- 光送進 PIC（fin：0–1）----
    const fin = o.fin || 0, Lx = this.wgLen * fin;
    this.beamMat.opacity = 0.1 + 0.3 * power + 0.35 * fin;
    this.wgLit.visible = fin > 0; this.wgLit.scale.x = Math.max(0.01, Lx); this.wgLit.position.set(Lx / 2, 0, 0);
    this.front.visible = fin > 0 && fin < 1; this.front.position.set(Lx, 0, 0); this.front.scale.set(14, 14, 1);
    const flow = power > 0.5 || fin > 0, P = L + Lx;
    this.pulses.forEach((s, i) => {
      s.visible = flow; if (!flow) return;
      const u = (((o.time || 0) * 0.45 + i / this.pulses.length) % 1) * P;
      if (u < L) s.position.copy(T).addScaledVector(d, u); else s.position.set(Math.min(u - L, Lx), 0, 0);
      s.scale.setScalar(5);
    });
    // ---- 鏡頭 ----
    this.ctl.enabled = o.mode === 'orbit';
    if (o.mode === 'orbit') {           // 旁觀：看尖端與 SSC 的中點，距離隨兩者距離縮放（對數平滑）
      const tgt = T.clone().multiplyScalar(0.5), want = Math.max(60, 2.6 * T.length());
      this.cameraSettling = Math.abs(this.dist - want) > .00001;
      this.dist = Math.exp(Math.log(this.dist) + (Math.log(want) - Math.log(this.dist)) * 0.12);
      const dir = this.cam.position.clone().sub(this.ctl.target).normalize();
      this.ctl.target.copy(tgt); this.cam.position.copy(tgt).addScaledVector(dir, this.dist); this.ctl.update();
    } else {                            // 化身光纖：鏡頭跟在光纖尖端後上方，一直盯著 SSC
      const want = Math.max(60, 0.25 * T.length());
      this.cameraSettling = Math.abs(this.dist - want) > .00001;
      this.dist = Math.exp(Math.log(this.dist) + (Math.log(want) - Math.log(this.dist)) * 0.15);
      const pos = T.clone().addScaledVector(d, -this.dist); pos.y += Math.max(90, 0.3 * this.dist);
      const look = new THREE.Vector3(0, 0, 0);
      if (fin > 0) {                    // 對準後鏡頭拉到側上方，跟著光往晶片裡走
        const b = fin < 0.6 ? (fin / 0.6) ** 2 * (3 - 2 * fin / 0.6) : 1;
        pos.lerp(new THREE.Vector3(-150 + 0.4 * Lx, 200, 380), b); look.lerp(new THREE.Vector3(0.5 * Lx, 0, 0), b);
      }
      this.cam.position.copy(pos); this.cam.lookAt(look); this.ctl.target.copy(look);
    }
    this.T = T; this.H = H;
    this.sceneKey = [pose.dx, pose.dy, pose.gap, pose.tx, pose.ty, pose.tz, power, fin, o.time, o.mode].join('|');
  }
  render() {
    if (!this.w || !this.h) return;
    this.cam.updateMatrixWorld();
    const cameraKey = this.cam.matrixWorld.elements.map(v => v.toFixed(4)).join('|');
    const key = this.sceneKey + cameraKey, now = performance.now();
    if (key !== this.lastSceneKey) this.lastMotion = now;
    this.lastSceneKey = key;
    const base = (window.devicePixelRatio || 1) * (window.__deckScale || 1);
    const high = Math.min(2.25, Math.max(1.8, base * 1.5), Math.sqrt(5200000 / (this.w * this.h)));
    const pr = this.quality === 'high' ? high : this.quality === 'fast' ? Math.min(1, base) : now - this.lastMotion > 220 ? high : Math.min(1.25, base);
    if (Math.abs(this.r.getPixelRatio() - pr) > .01) { this.r.setPixelRatio(pr); this.lastDrawKey = ''; }
    if (key === this.lastDrawKey) return;
    this.lastDrawKey = key; this.r.render(this.scene, this.cam); return true;
  }
  project(v) { const q = v.clone().project(this.cam); return { x: ((q.x + 1) / 2) * this.w, y: ((1 - q.y) / 2) * this.h, front: q.z < 1 }; }
}
