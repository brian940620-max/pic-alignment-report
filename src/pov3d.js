// 對準時的兩個視角：左＝從透鏡光纖尖端往前看（光纖視角），右＝從 PIC 的 SSC 往光纖看（PIC 視角）。
// 同一個場景、兩台相機、兩個 renderer；長度單位 µm（真實比例），用對數深度緩衝處理 0.1 µm–50 mm 的範圍。
// 座標：x＝光軸（晶片端面在 x=0，晶片在 x>0），y＝垂直（Y），z＝水平（X）。光纖尖端在 (−間距, dy, dx)。
import * as THREE from 'three';
import { beamAt } from './physics.js';

const L_FIBER = 1, L_SPOT = 2;           // 圖層：光纖本體只給 PIC 視角看；端面光點只給光纖視角看

function lathe(profile, mat, seg = 64) {     // profile：[[r, x]]，繞 x 軸
  const g = new THREE.LatheGeometry(profile.map(([r, x]) => new THREE.Vector2(r, x)), seg);
  g.rotateZ(-Math.PI / 2);
  return new THREE.Mesh(g, mat);
}
function glowTex(r, g, b) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(255,255,255,1)`); gr.addColorStop(0.25, `rgba(${r},${g},${b},.9)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class Pov3D {
  constructor(holderF, holderP, p) {
    this.p = p;
    const sc = (this.scene = new THREE.Scene());
    sc.background = new THREE.Color(0x03060d);
    sc.add(new THREE.HemisphereLight(0xbcd4ff, 0x0a0f1c, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-1, 2, 1.5); sc.add(key);
    const mk = (holder, fov) => {
      const r = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
      r.toneMapping = THREE.ACESFilmicToneMapping; holder.prepend(r.domElement);
      const cam = new THREE.PerspectiveCamera(fov, 1, 0.05, 3e5);
      return { r, cam, holder };
    };
    this.F = mk(holderF, 60); this.P = mk(holderP, 60);
    this.F.cam.layers.enable(L_SPOT);
    this.P.cam.layers.enable(L_FIBER);

    // ---- PIC 晶片（端面在 x=0）----
    const chip = new THREE.Group(); sc.add(chip);
    const box = (w, hgt, d, mat, x, y, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), mat); m.position.set(x, y, z); chip.add(m); return m; };
    box(3000, 700, 5000, new THREE.MeshStandardMaterial({ color: 0x2b313d, metalness: 0.75, roughness: 0.3, emissive: 0x111a2a, emissiveIntensity: 1 }), 1500, -356);          // 矽基板
    box(3000, 5, 5000, new THREE.MeshStandardMaterial({ color: 0x6d84a8, metalness: 0.1, roughness: 0.25, emissive: 0x2a4670, emissiveIntensity: 0.9 }), 1500, -3.5);          // BOX 氧化層
    box(3000, 12, 5000, new THREE.MeshStandardMaterial({ color: 0x9cc4ef, metalness: 0, roughness: 0.15, transparent: true, opacity: 0.55, emissive: 0x1f3f66, emissiveIntensity: 0.7 }), 1500, 5); // 上包層
    // SSC 端點：每 127 µm 一個，中間那個是目標
    this.ssc = [];
    for (let k = -12; k <= 12; k++) {
      const m = new THREE.MeshStandardMaterial({ color: 0x0b2a40, emissive: k === 0 ? 0x29b6ff : 0x1c6f9a, emissiveIntensity: k === 0 ? 1.2 : 0.5 });
      const e = new THREE.Mesh(new THREE.BoxGeometry(400, 3, 3), m); e.position.set(200 - 0.02, 0, k * 127); chip.add(e);
      if (k === 0) this.target = m;
    }
    // 目標環（只在端面前方一點點）
    const ringM = new THREE.MeshBasicMaterial({ color: 0x5fd4ff, transparent: true, opacity: 0.9 });
    for (const [r, t] of [[8, 0.35], [40, 1.2], [200, 5]]) { const rg = new THREE.Mesh(new THREE.TorusGeometry(r, t, 12, 96), ringM); rg.rotation.y = Math.PI / 2; rg.position.x = -0.3; sc.add(rg); }
    // 對位記號（十字）
    for (const z of [-800, 800]) for (const [w, hh] of [[60, 8], [8, 60]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, hh, w), new THREE.MeshBasicMaterial({ color: 0xd4af37 })); m.position.set(-0.2, 40, z); sc.add(m); }

    // ---- 透鏡光纖（只給 PIC 視角看）----
    this.fiber = new THREE.Group(); sc.add(this.fiber);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x8fb6e6, metalness: 0, roughness: 0.08, transparent: true, opacity: 0.55, clearcoat: 1 });
    const prof = [[0, -8000], [62.5, -8000], [62.5, -170]];
    for (let k = 1; k <= 20; k++) { const u = k / 20; prof.push([62.5 + (22 - 62.5) * u * u * (3 - 2 * u), -170 + u * (170 - 12)]); }
    for (let k = 1; k <= 16; k++) { const a = (k / 16) * (Math.PI / 2); prof.push([22 * Math.cos(a), -12 + 12 * Math.sin(a)]); }
    const fb = lathe(prof, glass); this.fiber.add(fb);
    const coreG = new THREE.CylinderGeometry(4.1, 4.1, 8000, 24); coreG.rotateZ(Math.PI / 2);
    const core = new THREE.Mesh(coreG, new THREE.MeshBasicMaterial({ color: 0xff8a3d })); core.position.x = -4170; this.fiber.add(core);
    const lensGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(255, 140, 60), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    lensGlow.scale.set(40, 40, 1); lensGlow.position.x = -6; this.fiber.add(lensGlow);
    const jacket = lathe([[0, -40000], [125, -40000], [125, -6000], [63, -6000]], new THREE.MeshStandardMaterial({ color: 0x2f6fd6, roughness: 0.5 })); this.fiber.add(jacket);
    this.fiber.traverse((o) => o.layers.set(L_FIBER));

    // ---- 光束（PIC 視角看得到）與端面光點（光纖視角看得到）----
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide });
    this.beam = new THREE.Mesh(new THREE.BufferGeometry(), this.beamMat); this.beam.layers.set(L_FIBER); sc.add(this.beam);
    this.spot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(255, 120, 40), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.spot.layers.set(L_SPOT); sc.add(this.spot);

    // ---- 空間中的微粒（看得出移動）----
    const N = 1500, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const x = -Math.exp(Math.log(8) + Math.random() * (Math.log(70000) - Math.log(8))); const r = Math.abs(x) * (0.15 + 1.2 * Math.random()), a = Math.random() * 6.283; pos.set([x, r * Math.cos(a), r * Math.sin(a)], i * 3); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x7fa6e0, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.55 }));
    pts.layers.enable(L_FIBER); sc.add(pts);

    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(holderF); this.ro.observe(holderP);
    window.addEventListener('deckscale', () => this.resize());
    this.resize();
  }

  resize() {
    for (const v of [this.F, this.P]) {
      const w = v.holder.clientWidth, h = v.holder.clientHeight; if (w < 2 || h < 2) continue;
      v.r.setPixelRatio(Math.min(2, (window.devicePixelRatio || 1) * (window.__deckScale || 1)));
      v.r.setSize(w, h, false); v.r.domElement.style.width = w + 'px'; v.r.domElement.style.height = h + 'px';
      v.cam.aspect = w / h; v.cam.updateProjectionMatrix(); v.w = w; v.h = h;
    }
  }

  // pose：{dx, dy, gap, tx, ty}（µm、rad）；power：0–1
  update(pose, power) {
    const T = new THREE.Vector3(-pose.gap, pose.dy, pose.dx);
    this.fiber.position.copy(T);
    this.fiber.rotation.set(0, 0, 0, 'YZX'); this.fiber.rotation.y = -pose.tx; this.fiber.rotation.z = pose.ty;
    this.fiber.updateMatrixWorld();
    const d = new THREE.Vector3(1, 0, 0).applyQuaternion(this.fiber.quaternion);
    // 光束：從尖端沿光軸到晶片端面
    const L = pose.gap / Math.max(0.2, d.x), p = this.p, pts = [];
    const us = []; for (let k = 0; k <= 48; k++) us.push(L * (Math.exp((k / 48) * Math.log(L + 1)) - 1) / L);
    for (const u of us) { const w = beamAt(p, u - p.WD).w; pts.push(new THREE.Vector2(Math.min(w, 1e5), u)); }
    const g = new THREE.LatheGeometry(pts, 40); g.rotateZ(-Math.PI / 2);
    this.beam.geometry.dispose(); this.beam.geometry = g;
    this.beam.position.copy(T); this.beam.quaternion.copy(this.fiber.quaternion);
    this.beamMat.opacity = 0.08 + 0.3 * power;
    // 端面光點
    const H = T.clone().add(d.clone().multiplyScalar(L)); H.x = -0.4;
    const wf = beamAt(p, pose.gap - p.WD).w;
    this.spot.position.copy(H); this.spot.scale.set(5 * wf, 5 * wf, 1);
    this.spot.material.opacity = Math.min(1, 0.25 + 3 * (p.wf / wf) ** 2);
    this.target.emissiveIntensity = 1.2 + 6 * power;
    // 相機
    this.F.cam.position.copy(T).addScaledVector(d, 0.3); this.F.cam.up.set(0, 1, 0); this.F.cam.lookAt(T.clone().add(d));
    this.P.cam.position.set(-0.6, 0, 0); this.P.cam.up.set(0, 1, 0); this.P.cam.lookAt(-10, 0, 0);
    this.T = T; this.H = H;
  }

  render() { this.F.r.render(this.scene, this.F.cam); this.P.r.render(this.scene, this.P.cam); }

  // 把世界座標投到某個視窗（回傳像素座標與是否在前方）
  project(which, v) {
    const view = which === 'F' ? this.F : this.P, q = v.clone().project(view.cam);
    const front = v.clone().sub(view.cam.position).dot(view.cam.getWorldDirection(new THREE.Vector3())) > 0;
    return { x: ((q.x + 1) / 2) * view.w, y: ((1 - q.y) / 2) * view.h, front };
  }
}
