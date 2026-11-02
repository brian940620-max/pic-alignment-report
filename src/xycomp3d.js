// 陣列分頁的 3D：XY 補回（虛擬旋轉中心）。
// 座標：x＝沿陣列（第 1 通道在 x = 0、往 −x 排，正面看時由左到右 1 → N），y 向上，z＝光軸（晶片端面在 z = 0，光纖陣列在 z < 0）。1 單位 = 100 µm。
// 機構層級：XY 平移台 → θz 旋轉台（轉軸在 x = r，平行光軸）→ 光纖陣列。所以 XY 補回時轉軸跟著移動。
// 角度放大 M 倍顯示（位移也跟著放大 M 倍）；XY 補回量用放大後的角度算，補回完成時第 1 通道在畫面上回到原位。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { studioEnv } from './studio-env.js';
import { fiberGlass } from './schem3d.js';

const U = 0.01;                                         // µm → 單位

export class XYComp3D {
  constructor(holder) {
    this.holder = holder;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true }));
    holder.append(r.domElement);
    this.lbl = new CSS2DRenderer(); this.lbl.domElement.className = 'lbls'; holder.append(this.lbl.domElement);
    const sc = (this.scene = new THREE.Scene()); sc.background = new THREE.Color(0x060b16);
    sc.add(new THREE.HemisphereLight(0xdde8ff, 0x1a2233, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(-8, 14, -10); sc.add(key);
    this.env = studioEnv(r); this.glass = fiberGlass(this.env);
    Object.assign(this.glass, { opacity: 0.16, envMapIntensity: 0.8 });      // 正面看穿過去：包層只留輪廓，不擋 SSC 與光纖核心
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 500);
    this.controls = new OrbitControls(this.camera, r.domElement); this.controls.enableDamping = true;
    this.fixed = new THREE.Group(); this.stage = new THREE.Group(); this.rot = new THREE.Group(); this.fa = new THREE.Group(); this.dyn = new THREE.Group();
    this.axisG = new THREE.Group();                        // 轉軸（掛在 XY 台上，跟著補回移動）
    this.rot.add(this.fa); this.stage.add(this.rot, this.axisG); sc.add(this.fixed, this.stage, this.dyn);
    this.key = '';
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(holder);
    window.addEventListener('deckscale', () => this.resize());
    this.resize();
  }

  lab(parent, text, cls, p) { const el = document.createElement('div'); el.className = 'c3l ' + cls; el.textContent = text; const o = new CSS2DObject(el); o.position.copy(p); parent.add(o); return o; }
  clear(g) { for (const o of [...g.children]) { g.remove(o); o.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material && !m.material.userData.keep) m.material.dispose(); if (m.element) m.element.remove(); }); } }

  // 幾何（通道數、間距、轉軸位置改了才重建）。正面看端面：第 i 通道在 x = −(i−1)·P，畫面上由左到右 1 → N；轉軸在 x = −r。
  build(N, P, rUm) {
    const key = `${N}/${P}/${rUm}`; if (key === this.key) return; this.key = key;
    this.clear(this.fixed); this.clear(this.fa); this.clear(this.axisG); this.trail = [];
    const span = (N - 1) * P * U, pr = rUm * U, X = (i) => -i * P * U;
    this.N = N; this.P = P; this.span = span; this.pr = pr;
    // 晶片（端面在 z = 0）與 SSC
    const W = Math.max(span, pr) + 6, xr = 3;
    // 矽基板（拋光深灰）＋上方氧化矽包層（SSC 就埋在這層裡，帶一點薄膜干涉色）
    const chip = new THREE.Mesh(new THREE.BoxGeometry(W, 3, 7), new THREE.MeshPhysicalMaterial({ color: 0x4a515e, metalness: 0.55, roughness: 0.26, clearcoat: 0.3, envMap: this.env, envMapIntensity: 0.9 }));
    chip.position.set(xr - W / 2, -1.9, 3.5); this.fixed.add(chip);
    const clad = new THREE.Mesh(new THREE.BoxGeometry(W, 0.9, 7), new THREE.MeshPhysicalMaterial({ color: 0x8aa3d6, roughness: 0.15, transparent: true, opacity: 0.45, depthWrite: false,
      iridescence: 1, iridescenceIOR: 1.46, iridescenceThicknessRange: [400, 1100], envMap: this.env, envMapIntensity: 0.8 }));
    clad.position.set(xr - W / 2, 0.05, 3.5); this.fixed.add(clad);
    for (let i = 0; i < N; i++) {
      const port = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 40), new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide })); port.position.set(X(i), 0, -0.01); this.fixed.add(port);
    }
    this.lab(this.fixed, 'PIC 端面（藍圈＝SSC，要對準的位置）', 'chip', new THREE.Vector3(-span / 2, -1.4, 0));
    // 光纖陣列（掛在旋轉台下：座標先平移到轉軸，再轉）
    this.rot.position.set(-pr, 0, 0); this.fa.position.set(pr, 0, 0);
    // 陣列玻璃塊（V 槽基板＋蓋板）：透明玻璃，裡面看得到每根光纖的包層（125 µm）
    const blk = new THREE.Mesh(new THREE.BoxGeometry(span + 3, 2.2, 5), new THREE.MeshPhysicalMaterial({ color: 0xc9dcf2, transparent: true, opacity: 0.22, roughness: 0.08,
      clearcoat: 0.5, ior: 1.5, specularIntensity: 1, envMap: this.env, envMapIntensity: 0.7, depthWrite: false }));
    blk.position.set(-span / 2, 0, -0.35 - 2.5); blk.renderOrder = 3; this.fa.add(blk);
    for (let i = 0; i < N; i++) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 5, 32), this.glass); f.rotation.x = Math.PI / 2; f.position.set(X(i), 0, -0.35 - 2.5); f.renderOrder = 2; this.fa.add(f);
    }
    for (let i = 0; i < N; i++) {
      const hl = i === 0 || i === N - 1;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 10), new THREE.MeshBasicMaterial({ color: hl ? 0xff8a3d : 0xffc48a, transparent: true, opacity: 0.35 }));
      c.rotation.x = Math.PI / 2; c.position.set(X(i), 0, -0.35 - 0.75); this.fa.add(c);
      const tip = new THREE.Mesh(new THREE.CircleGeometry(0.17, 28), new THREE.MeshBasicMaterial({ color: hl ? 0xff8a3d : 0xffb86b, side: THREE.DoubleSide })); tip.position.set(X(i), 0, -0.36); this.fa.add(tip);
    }
    this.tip1 = new THREE.Object3D(); this.tip1.position.set(0, 0, -0.36); this.fa.add(this.tip1);
    this.lab(this.fa, '第 1 通道', 'waist', new THREE.Vector3(0, 0.8, -0.4));
    this.lab(this.fa, `第 ${N} 通道`, 'waist', new THREE.Vector3(X(N - 1), 0.8, -0.4));
    // 旋轉台的轉軸（跟著 XY 台移動）：端面上畫 ✕，並畫出第 1 通道會走的圓弧（以轉軸為圓心、半徑 r）
    const ax = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -12), new THREE.Vector3(0, 0, -0.3)]), new THREE.LineDashedMaterial({ color: 0xffd29a, dashSize: 0.4, gapSize: 0.25 }));
    ax.computeLineDistances(); ax.position.set(-pr, 0, 0); this.axisG.add(ax);
    const k = 0.22, cross = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-k, -k, 0), new THREE.Vector3(k, k, 0), new THREE.Vector3(-k, k, 0), new THREE.Vector3(k, -k, 0)]), new THREE.LineBasicMaterial({ color: 0xffd29a }));
    cross.position.set(-pr, 0, -0.4); this.axisG.add(cross);
    this.lab(this.axisG, '平台的 θz 轉軸', 'lens', new THREE.Vector3(-pr, -0.8, -0.4));
    if (pr > 0.05) {
      const pts = []; for (let a = -0.6; a <= 0.6001; a += 0.02) pts.push(new THREE.Vector3(-pr + pr * Math.cos(a), pr * Math.sin(a), -0.4));
      const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0xff8a70, dashSize: 0.15, gapSize: 0.12 })); arc.computeLineDistances(); this.axisG.add(arc);
    }
    // 鏡頭：正面看端面（稍微從上方）
    const cx = -Math.max(span, pr) / 2;
    this.home = { pos: new THREE.Vector3(cx, 2.4, -12 - Math.max(span, pr) * 0.75), tgt: new THREE.Vector3(cx, -0.2, 0) };
    this.camera.position.copy(this.home.pos); this.controls.target.copy(this.home.tgt);
  }

  // st：{ N, P, r(µm), thd(放大後的顯示角，rad), f(XY 補回比例 0→1), arrow(是否畫「移回」箭頭), resetTrail }
  update(st) {
    this.build(st.N, st.P, st.r);
    const pr = st.r * U, th = st.thd;
    const d1 = new THREE.Vector2(pr * (Math.cos(th) - 1), -pr * Math.sin(th));      // 第 1 通道被帶走（顯示座標）
    this.rot.rotation.z = -th;
    this.stage.position.set(-d1.x * st.f, -d1.y * st.f, 0);
    this.clear(this.dyn);
    const p1 = new THREE.Vector3(); this.tip1.getWorldPosition(p1);
    if (st.resetTrail) this.trail = [];
    const lastP = this.trail[this.trail.length - 1]; if (!lastP || lastP.distanceTo(p1) > 0.005) this.trail.push(p1.clone());
    if (this.trail.length > 1) this.dyn.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(this.trail.map((q) => q.clone().setZ(-0.45))), new THREE.LineBasicMaterial({ color: 0xff4d4d })));
    const back = new THREE.Vector3(-p1.x, -p1.y, 0);
    if (st.arrow && back.length() > 0.05) {
      this.dyn.add(new THREE.ArrowHelper(back.clone().normalize(), p1.clone().setZ(-0.5), back.length(), 0x69db7c, Math.min(0.35, back.length() * 0.45), Math.min(0.22, back.length() * 0.3)));
      this.lab(this.dyn, 'XY 台往反方向移回', 'chip', p1.clone().add(back.clone().multiplyScalar(0.5)).add(new THREE.Vector3(0, -0.7, -0.5)));
    }
    if (st.f >= 1 && Math.abs(th) > 1e-6) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.55, 40), new THREE.MeshBasicMaterial({ color: 0x69db7c, side: THREE.DoubleSide })); ring.position.set(0, 0, -0.5); this.dyn.add(ring);
      this.lab(this.dyn, '虛擬旋轉中心', 'chip', new THREE.Vector3(0, -0.9, -0.5));
    }
  }

  resetView() { this.camera.position.copy(this.home.pos); this.controls.target.copy(this.home.tgt); }
  resize() {
    const w = this.holder.clientWidth, h = this.holder.clientHeight; if (w < 2 || h < 2) return;
    this.renderer.setPixelRatio(Math.min(2, (window.devicePixelRatio || 1) * (window.__deckScale || 1)));
    this.renderer.setSize(w, h, false); this.renderer.domElement.style.width = w + 'px'; this.renderer.domElement.style.height = h + 'px';
    this.lbl.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  start(onFrame) { if (this.on) return; this.on = true; this.resize(); const tick = (now) => { if (!this.on) return; onFrame && onFrame(now); this.controls.update(); this.renderer.render(this.scene, this.camera); this.lbl.render(this.scene, this.camera); this.raf = requestAnimationFrame(tick); }; this.raf = requestAnimationFrame(tick); }
  stop() { this.on = false; cancelAnimationFrame(this.raf); }
}
