// 第六、七頁的 3D 示意（跟著同一組滑桿）：
//   'shift'：為什麼光斑會離開白色虛線——光軸繞光纖尖端轉 θ，打到端面時中心移動 Z·tanθ。
// Z 軸水平：世界 x＝光軸（端面 Z=0 是 x=0 的直立平面，移動光纖在左邊 x<0，固定光纖＝接收端在右邊 x>0），
// 世界 y＝Y（往上）、世界 z＝X（朝向觀看者）。長度依 Z 自動縮放（尖端離端面約 9 單位）；光纖粗細只是示意。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { LAMBDA } from './physics.js';
import { studioEnv } from './studio-env.js';
import { SchematicFinish } from './schematic-realism.js';
import { h } from './ui.js';

// 玻璃光纖包層：透明、有反光，看得到裡面的核心（重畫時共用，不釋放，免得拖滑桿時重新編譯著色器）
export function fiberGlass(env) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xbcd8f5, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.42, clearcoat: 1, clearcoatRoughness: 0.05,
    ior: 1.45, specularIntensity: 1, envMap: env, envMapIntensity: 1.6, depthWrite: false });
  m.userData.keep = true; return m;
}

export class Schem3D {
  constructor(holder, mode, { realistic = false } = {}) {
    this.holder = holder; this.mode = mode;
    this.materials = new Map();
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true }));
    holder.append(r.domElement);
    this.lbl = new CSS2DRenderer(); this.lbl.domElement.className = 'lbls'; holder.append(this.lbl.domElement);
    const sc = (this.scene = new THREE.Scene()); sc.background = new THREE.Color(0x060b16);
    sc.add(new THREE.HemisphereLight(0xdde8ff, 0x1a2233, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 1); key.position.set(-10, 18, 14); sc.add(key);
    this.glass = fiberGlass(studioEnv(r));
    if (realistic) {
      this.glass.opacity = .4; this.glass.envMapIntensity = 1.05;
      this.finish = new SchematicFinish(sc, r, this.glass);
    }
    this.camera = new THREE.PerspectiveCamera(realistic ? 40 : 36, 1, 0.1, 500);
    this.camera.position.set(-12, 12, 52);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.target.set(-4.5, 0, 2); this.controls.enableDamping = true;
    this.controls.addEventListener('change', () => this.requestRender());
    if (realistic) {
      this.motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.effectTime = 0;
      const motion = h('button', { type: 'button', class: 'btn ghost', 'aria-pressed': String(this.motion), onclick: () => {
        this.motion = !this.motion; motion.textContent = this.motion ? '暫停光流' : '播放光流'; motion.setAttribute('aria-pressed', String(this.motion)); this.requestRender();
      } }, this.motion ? '暫停光流' : '播放光流');
      holder.append(h('div', { class: 'schematic-tools' }, motion,
        h('button', { type: 'button', class: 'btn ghost', onclick: () => {
          this.controls.enableDamping = false; this.controls.update(); this.controls.enableDamping = true;
          this.camera.position.set(-12, 12, 52); this.controls.target.set(-4.5, 0, 2); this.controls.update(); this.requestRender();
        } }, '重置視角')));
      holder.classList.add('schematic-studio');
    }
    // 端面（Z = 0 平面，直立；網格和原本一樣 26 × 18、13 格）
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(26, 18), new THREE.MeshStandardMaterial({ color: 0x1d2a40, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    plane.rotation.y = Math.PI / 2; plane.position.z = 4; sc.add(plane);
    const grid = new THREE.GridHelper(26, 13, 0x3f6aa8, 0x24395c); grid.scale.set(18 / 26, 1, 1); grid.rotation.z = Math.PI / 2; grid.position.set(-0.01, 0, 4); sc.add(grid);
    if (realistic) { plane.material.opacity = .035; grid.material.transparent = true; grid.material.opacity = .22; }
    // 接收端兩種：固定光纖（光纖對光纖）或 PIC 晶片（透鏡光纖對 PIC，計畫版加）；setReceiver() 切換
    this.recvFiber = new THREE.Group(); this.recvPic = new THREE.Group(); sc.add(this.recvFiber, this.recvPic);
    const fixed = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 48), this.glass);
    fixed.rotation.z = Math.PI / 2; fixed.position.x = 3; fixed.renderOrder = 2; this.recvFiber.add(fixed);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6.02, 12), new THREE.MeshBasicMaterial({ color: 0x5aa0ff }));
    core.rotation.z = Math.PI / 2; core.position.x = 3; this.recvFiber.add(core);
    if (this.finish) this.finish.collar(this.recvFiber, new THREE.Vector3(5.3, 0, 0), new THREE.Vector3(1, 0, 0), .67);
    const fl = document.createElement('div'); fl.className = 'c3l chip'; fl.textContent = '固定光纖（接收端）';
    const flo = new CSS2DObject(fl); flo.position.set(6, -5, 0); this.recvFiber.add(flo);
    // PIC：晶片側面＝端面（x = 0），邊緣耦合器（波導）在原點、靠近晶片上表面
    const chip = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 16), new THREE.MeshStandardMaterial({ color: 0x7d8aa6, metalness: 0.25, roughness: 0.45, transparent: true, opacity: 0.55, depthWrite: false }));
    chip.position.set(3.5, -2.0, 4); chip.renderOrder = 1; this.recvPic.add(chip);
    const wg = new THREE.Mesh(new THREE.BoxGeometry(7, 0.22, 0.32), new THREE.MeshBasicMaterial({ color: 0x5aa0ff }));
    wg.position.set(3.5, 0, 0); this.recvPic.add(wg);
    if (this.finish) { chip.visible = wg.visible = false; this.finish.pic(this.recvPic); }
    const pl = document.createElement('div'); pl.className = 'c3l chip'; pl.textContent = 'PIC 晶片（邊緣耦合器）';
    const plo = new CSS2DObject(pl); plo.position.set(4, realistic ? 3.8 : 1.6, 0); this.recvPic.add(plo);
    this.setReceiver('fiber');
    this.dyn = new THREE.Group(); sc.add(this.dyn);
    r.compileAsync(sc, this.camera).catch(() => {});   // 背景平行編譯著色器
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(holder);
    window.addEventListener('deckscale', () => this.resize());
    this.resize();
  }

  setReceiver(kind) {   // 'fiber'＝固定光纖；'pic'＝PIC 晶片，移動光纖的尖端畫成透鏡
    this.recv = kind; this.recvFiber.visible = kind === 'fiber'; this.recvPic.visible = kind === 'pic';
    for (const g of [this.recvFiber, this.recvPic]) g.traverse((o) => { if (o.element) o.element.style.display = g.visible ? '' : 'none'; });
    if (this.lastSt) this.update(this.lastSt);
  }

  clear() { for (const o of [...this.dyn.children]) { this.dyn.remove(o); o.traverse((m) => { if (m.geometry && !m.geometry.userData.keep) m.geometry.dispose(); if (m.material && !m.material.userData.keep) m.material.dispose(); if (m.element) m.element.remove(); }); } }
  material(key, create) {
    if (!this.materials.has(key)) { const material = create(); material.userData.keep = true; this.materials.set(key, material); }
    return this.materials.get(key);
  }
  lab(text, cls, p) { const el = document.createElement('div'); el.className = 'c3l ' + cls; el.textContent = text; const o = new CSS2DObject(el); o.position.copy(p); this.dyn.add(o); return o; }
  line(a, b, color, dashed = false, width = 1) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const m = this.material(`line:${color}:${dashed}:${width}`, () => dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.35, gapSize: 0.25 }) : new THREE.LineBasicMaterial({ color, linewidth: width }));
    const l = new THREE.Line(g, m); if (dashed) l.computeLineDistances(); this.dyn.add(l); return l;
  }
  tube(a, b, r, color) { const c = new THREE.LineCurve3(a, b), m = new THREE.Mesh(new THREE.TubeGeometry(c, 1, r, 12), this.material(`tube:${color}`, () => new THREE.MeshBasicMaterial({ color }))); this.dyn.add(m); return m; }
  // 端面上的橢圓（長軸 ra 沿端面內的方向 phi，短軸 rb），稍微浮在端面前方
  ring(center, ra, rb, phi, color, dashed = false) {
    const pts = [], c = Math.cos(phi), s = Math.sin(phi);
    for (let k = 0; k <= 96; k++) { const a = (k / 96) * Math.PI * 2, u = ra * Math.cos(a), v = rb * Math.sin(a); pts.push(new THREE.Vector3(-0.04, center.y + u * s + v * c, center.z + u * c - v * s)); }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const material = this.material(`ring:${color}:${dashed}`, () => dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.3, gapSize: 0.2 }) : new THREE.LineBasicMaterial({ color }));
    const l = new THREE.Line(g, material); if (dashed) l.computeLineDistances(); this.dyn.add(l); return l;
  }

  // st：{x, y, z, tx, ty, tz, wsx, wsy, wd}（µm、rad）
  update(st) {
    const hostSlide = this.holder.closest('.slide');
    const key = JSON.stringify([st, this.recv, hostSlide?.dataset.activeAxis, hostSlide?.dataset.progressPage]);
    if (key === this.stateKey) return;
    this.stateKey = key;
    this.clear(); this.lastSt = st; this.requestRender();
    const k = 9 / Math.max(st.z, 20);                                    // µm → 單位
    const tip = new THREE.Vector3(-st.z * k, st.y * k, st.x * k);
    const dir = new THREE.Vector3(1, Math.tan(st.tx), Math.tan(st.ty)).normalize();   // θx 往 Y、θy 往 X
    const hit = tip.clone().addScaledVector(dir, -tip.x / dir.x);
    const foot = new THREE.Vector3(0, tip.y, tip.z);
    const zr = (Math.PI * st.wsx * st.wsx) / LAMBDA, wAt = (u) => st.wsx * Math.sqrt(1 + ((u - (st.wd || 0)) / zr) ** 2);
    const th = Math.acos(dir.x), phi = Math.atan2(hit.y - foot.y, hit.z - foot.z);
    // 移動光纖（沿光軸往左）
    const fBack = tip.clone().addScaledVector(dir, -6);
    if (this.finish) {
      this.finish.fiber(this.dyn, tip, fBack, dir, this.glass, this.recv === 'pic');
      this.finish.light(this.dyn, tip, hit, dir, wAt, k, st, th, phi);
    } else {
    this.tube(tip, fBack, 0.12, 0xff8a3d);
    const clad = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(tip, fBack), 1, 0.5, 48), this.glass); clad.renderOrder = 2; this.dyn.add(clad);
    if (this.recv === 'pic') {   // 透鏡光纖：尖端是半球透鏡
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), this.glass);
      lens.position.copy(tip); lens.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); lens.renderOrder = 2; this.dyn.add(lens);
    } else { const face = new THREE.Mesh(new THREE.CircleGeometry(0.5, 48), this.glass); face.position.copy(tip); face.lookAt(tip.clone().add(dir)); face.renderOrder = 2; this.dyn.add(face); }
    }
    this.lab(this.recv === 'pic' ? '透鏡光纖尖端（旋轉中心）' : '移動光纖尖端（旋轉中心）', 'waist', tip.clone().add(new THREE.Vector3(this.finish ? -1 : -5, this.finish ? 4.5 : 3.5, 0)));
    // 沒有角度：水平打到端面；有角度：繞尖端轉 θ
    this.line(tip, foot, 0xffffff, true);
    this.tube(tip, hit, this.finish ? .028 : .07, this.finish ? 0xffdc9f : 0xff7a2a);
    this.ring(foot, wAt(st.z) * k, wAt(st.z) * k, 0, 0xffffff, true);
    this.ring(hit, (wAt(st.z / Math.cos(th)) * k) / Math.cos(th), wAt(st.z / Math.cos(th)) * k, phi, 0xff7a2a);
    if (hit.distanceTo(foot) > 0.05) {
      this.tube(foot.clone().setX(-0.06), hit.clone().setX(-0.06), 0.06, 0xff4d4d);
      this.lab(`偏移 Z·tanθ = ${(st.z * Math.tan(th)).toFixed(1)} µm`, 'lens', foot.clone().lerp(hit, 0.5).add(new THREE.Vector3(3, 7, 0)));
      // 角度弧
      const arc = []; for (let i = 0; i <= 24; i++) { const v = new THREE.Vector3(1, 0, 0).lerp(dir, i / 24).normalize().multiplyScalar(3); arc.push(tip.clone().add(v)); }
      const al = new THREE.Line(new THREE.BufferGeometry().setFromPoints(arc), this.material('angle', () => new THREE.LineBasicMaterial({ color: 0xffd29a }))); this.dyn.add(al);
      this.lab(`θ = ${(th * 180 / Math.PI).toFixed(1)}°`, 'layer on', arc[12].clone().add(new THREE.Vector3(0, 0.9, 0)));
    }
    this.lab('沒有角度：白虛線', 'dim', foot.clone().add(new THREE.Vector3(-0.3, -2.2, 0)));
    this.lab(`Z = ${st.z} µm`, 'layer', tip.clone().lerp(foot, 0.5).add(new THREE.Vector3(0, -1.1, 0)));
    const slide=this.holder.closest('.slide'), raw=slide?.dataset.activeAxis;
    if(raw!==undefined){
      const index=slide.dataset.progressPage==='6'?[4,3,2][Number(raw)]:Number(raw);
      const directions=[new THREE.Vector3(0,0,1),new THREE.Vector3(0,1,0),new THREE.Vector3(1,0,0)];
      if(index<3){
        const arrow=new THREE.ArrowHelper(directions[index],tip,4,0xffdc98,.7,.35);this.dyn.add(arrow);
        this.lab(['X 橫向','Y 垂直','Z 間距'][index],'axis-highlight',tip.clone().addScaledVector(directions[index],4.8));
      }else{
        const pts=[];
        for(let j=0;j<=40;j++){const a=j/40*Math.PI*1.5,r=2.5;const p=index===3?new THREE.Vector3(r*Math.cos(a),r*Math.sin(a),0):index===4?new THREE.Vector3(r*Math.cos(a),0,r*Math.sin(a)):new THREE.Vector3(0,r*Math.cos(a),r*Math.sin(a));pts.push(p.add(tip));}
        this.dyn.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xffdc98})));
        const dir=pts[40].clone().sub(pts[39]).normalize();this.dyn.add(new THREE.ArrowHelper(dir,pts[40],.65,0xffdc98,.45,.3));
        this.lab(['θx 俯仰方向','θy 偏擺方向','θz 滾轉方向'][index-3],'axis-highlight',tip.clone().add(new THREE.Vector3(-5,7,0)));
      }
    }
  }

  requestRender() {
    if (!this.on || this.raf) return;
    this.raf = requestAnimationFrame(now => {
      this.raf = 0;
      if (!this.on) return;
      const moved = this.controls.update();
      if (this.finish) {
        if (this.motion) this.effectTime += Math.min(.05, Math.max(0, (now - (this.lastFrame || now)) / 1000));
        this.finish.time.value = this.effectTime; this.lastFrame = now;
      }
      this.renderer.render(this.scene, this.camera); this.lbl.render(this.scene, this.camera);
      if (moved || (this.finish && this.motion)) this.requestRender();
    });
  }
  resize() {
    const w = this.holder.clientWidth, h = this.holder.clientHeight; if (w < 2 || h < 2) return;
    const dpr = Math.min(2, (window.devicePixelRatio || 1) * (window.__deckScale || 1));
    const key = `${w}:${h}:${dpr}`; if (this.sizeKey === key) return; this.sizeKey = key;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false); this.renderer.domElement.style.width = w + 'px'; this.renderer.domElement.style.height = h + 'px';
    this.lbl.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.requestRender();
  }
  start() { if (this.on) return; this.on = true; this.resize(); this.requestRender(); }
  stop() { this.on = false; cancelAnimationFrame(this.raf); this.raf = 0; this.lastFrame = 0; }
}
