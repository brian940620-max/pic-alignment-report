// 簡報嵌入版的「寫實化」收尾（build.mjs 只在產生 platform_embed.html 時附加）。
// 只動光照、環境反射、地面、陰影與後製；不動任何幾何、父子階層、旋轉中心與運動。
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';

let platformHighlightStrength = .12;
{
  VIEWS.all = [[1480, 1150, 1620], [400, 140, -200]];

  // ---- 實驗室環境貼圖：天花板燈條、側窗、主燈柔光箱。金屬件的反光就是靠這張圖才像真的 ----
  const labEnv = (() => {
    const env = new THREE.Scene(), cube = new THREE.BoxGeometry(1, 1, 1), quad = new THREE.PlaneGeometry(1, 1);
    const lum = (r, g, b) => new THREE.MeshBasicMaterial({color: new THREE.Color(r, g, b), side: THREE.DoubleSide});
    const wall = lum(.085, .092, .105), room = new THREE.Mesh(cube, [wall, wall, lum(.15, .155, .165), lum(.03, .032, .036), wall, wall]);
    room.material.forEach(m => m.side = THREE.BackSide);
    room.scale.set(16, 3.8, 16); room.position.y = .7; env.add(room);
    const panel = (w, h, pos, look, mat) => { const m = new THREE.Mesh(quad, mat); m.scale.set(w, h, 1); m.position.set(...pos); m.lookAt(...look); env.add(m); };
    const strip = lum(7.5, 7.6, 7.9);                                   // 天花板 T5 燈條（長條高光）
    for (const x of [-4.5, -1.5, 1.5, 4.5]) for (const z of [-4.2, 0, 4.2]) panel(.42, 2.6, [x, 2.57, z], [x, 0, z], strip);
    panel(3.2, 2.2, [1.2, 2.3, 1.9], [0, 0, 0], lum(9, 8.6, 8));           // 主燈柔光箱（與太陽光同方位，暖白）
    panel(5.5, 1.5, [-7.95, 1.1, -.5], [0, 1.1, -.5], lum(2.2, 2.6, 3.1)); // 側窗（冷色）
    panel(3, 1.8, [-4.5, 1.4, -7.95], [-4.5, 1.4, 0], lum(2.6, 2.8, 3.2)); // 背光
    const kit = lum(.018, .019, .022);                                   // 牆邊的機櫃、桌子：讓反光有遮擋
    for (const [w, h, d, x, z] of [[1.6, 1.9, .7, 5.5, -7.4], [1, 1.3, .7, 7.4, 2], [2.4, .9, .8, -2.5, 7.5], [.8, 2, .8, -7.5, 4.5]]) {
      const b = new THREE.Mesh(cube, kit); b.scale.set(w, h, d); b.position.set(x, -1.1 + h / 2, z); env.add(b);
    }
    const pm = new THREE.PMREMGenerator(renderer), tex = pm.fromScene(env, .035).texture; pm.dispose();
    return tex;
  })();
  scene.environment = labEnv;
  scene.environmentIntensity = .85;
  scene.background = labEnv;                 // 背景＝同一個實驗室，模糊後只留燈與牆的明暗
  scene.backgroundBlurriness = .62;
  scene.backgroundIntensity = .3;
  scene.fog.color.setHex(0x161b21);
  scene.fog.near = 3600; scene.fog.far = 9800;

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // ---- 燈光：環境貼圖負責大部分補光，主光負責陰影 ----
  scene.traverse(o => { if (o.isHemisphereLight) o.intensity = .16; });
  sun.color.setHex(0xfff4e6);
  sun.intensity = 1.9;
  sun.position.set(350, 1400, 700);
  sun.shadow.mapSize.set(3072, 3072);   // 只在零件移動時更新（見檔尾），所以可以比原本的 2048 細一些
  Object.assign(sun.shadow.camera, {left: -1150, right: 1750, top: 1150, bottom: -1150});
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -.00008;
  sun.shadow.normalBias = .12;
  const fill = new THREE.DirectionalLight(0xdceaff, .35);
  fill.position.set(-850, 650, 450);
  scene.add(fill);

  // ---- 地面：實驗室塑膠地磚（600 mm，一張圖 2×2 片），帶細斑、接縫與些微光澤 ----
  {
    const N = 1024, cv = document.createElement('canvas'), rc = document.createElement('canvas');
    cv.width = cv.height = rc.width = rc.height = N;
    const c = cv.getContext('2d'), r = rc.getContext('2d');
    let seed = 4242; const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    const tone = [[33, 36, 41], [31, 34, 39], [32, 35, 40], [30, 33, 38]];
    for (let i = 0; i < 4; i++) { const [R, G, B] = tone[i]; c.fillStyle = `rgb(${R},${G},${B})`; c.fillRect((i % 2) * N / 2, (i >> 1) * N / 2, N / 2, N / 2); }
    r.fillStyle = '#8a8a8a'; r.fillRect(0, 0, N, N);
    for (let k = 0; k < 26000; k++) {                                   // 地磚的細斑
      const x = rnd() * N, y = rnd() * N, s = .6 + rnd() * 1.6, v = rnd();
      c.fillStyle = v < .5 ? `rgba(20,22,26,${.25 + rnd() * .3})` : `rgba(110,116,124,${.12 + rnd() * .2})`; c.fillRect(x, y, s, s);
      r.fillStyle = `rgba(${v < .5 ? 190 : 100},${v < .5 ? 190 : 100},${v < .5 ? 190 : 100},.35)`; r.fillRect(x, y, s * 2, s * 2);
    }
    for (let k = 0; k < 90; k++) {                                     // 淡淡的使用痕跡（光澤不均）
      const x = rnd() * N, y = rnd() * N, rad = 30 + rnd() * 120, g = r.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(${rnd() < .5 ? 60 : 170},${rnd() < .5 ? 60 : 170},${rnd() < .5 ? 60 : 170},.18)`); g.addColorStop(1, 'rgba(138,138,138,0)');
      r.fillStyle = g; r.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    c.fillStyle = '#16181c'; r.fillStyle = '#e0e0e0';
    for (const p of [0, N / 2]) { c.fillRect(p, 0, 2, N); c.fillRect(0, p, N, 2); r.fillRect(p, 0, 3, N); r.fillRect(0, p, N, 3); }
    const tex = (canvas, srgb) => { const t = new THREE.CanvasTexture(canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9000 / 1200, 9000 / 1200);
      t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy()); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
    Object.assign(floor.material, {color: new THREE.Color(0xffffff), map: tex(cv, true), roughnessMap: tex(rc), roughness: .8, metalness: 0, envMap: labEnv, envMapIntensity: .4});
    floor.material.needsUpdate = true;
  }

  // ---- 儀器桌面：原本的單色木色換成淺橡木紋（顏色不變，只加紋理與一點光澤） ----
  const oak = (() => {
    const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 256;
    const c = cv.getContext('2d'); let seed = 99; const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    c.fillStyle = '#b9a88f'; c.fillRect(0, 0, 2048, 256);
    for (let k = 0; k < 220; k++) {
      const y0 = rnd() * 256, a = 2 + rnd() * 6, f = .002 + rnd() * .006, ph = rnd() * 6.3, dark = rnd() < .7;
      c.strokeStyle = dark ? `rgba(120,95,66,${.06 + rnd() * .16})` : `rgba(226,212,188,${.05 + rnd() * .1})`;
      c.lineWidth = .6 + rnd() * 2.2; c.beginPath();
      for (let x = 0; x <= 2048; x += 16) { const y = y0 + a * Math.sin(x * f + ph) + 1.5 * Math.sin(x * f * 3.7 + ph * 2); x ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke();
    }
    for (let k = 0; k < 40; k++) { c.fillStyle = `rgba(110,85,60,${.08 + rnd() * .1})`; c.beginPath(); c.ellipse(rnd() * 2048, rnd() * 256, 6 + rnd() * 18, 1.5 + rnd() * 3, 0, 0, 7); c.fill(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy()); return t;
  })();

  // ---- 材質微調：機加工金屬多一點環境反射，陽極黑帶一點冷色光澤；光學、印刷、塗裝面不動 ----
  const treated = new Set(), woodRef = new THREE.Color(0xb9a88f);
  scene.traverse(o => {
    if (!o.isMesh || o === floor) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || treated.has(m) || !m.isMeshStandardMaterial || m.transparent || m.emissiveIntensity > 1) continue;
      treated.add(m);
      m.envMap = labEnv; m.needsUpdate = true;   // 有自己的 envMap，下面的 envMapIntensity 才會生效（scene.environment 會蓋掉它）
      if (m.map) { m.envMapIntensity = .8; continue; }
      if (Math.abs(m.color.r - woodRef.r) + Math.abs(m.color.g - woodRef.g) + Math.abs(m.color.b - woodRef.b) < .004) { m.color.setHex(0xffffff); m.map = oak; m.roughness = .55; m.envMapIntensity = .45; m.needsUpdate = true; continue; }
      if (m.roughnessMap && m.metalness >= .5) {
        const silver = m.metalness >= .7;
        if (silver) { m.metalness = .92; m.roughness = Math.min(.34, Math.max(.24, m.roughness * .85)); m.envMapIntensity = 1.25; }
        else { m.metalness = .6; m.roughness = Math.max(.36, m.roughness * .9); m.envMapIntensity = 1.05; }
      } else if (m.metalness >= .5) m.envMapIntensity = 1.15;
      else { m.roughness = Math.min(.72, Math.max(.4, m.roughness)); m.envMapIntensity = .85; }
    }
  });

  // ---- 耦合區特寫：光纖改成透明玻璃、PIC 晶片改成拋光矽（只改材質，尺寸位置不動） ----
  for (const g of parts.R15 || []) g.traverse(o => {
    if (!o.isMesh || !/Cylinder|Cone/.test(o.geometry.type)) return;
    Object.assign(o.material, {color: new THREE.Color(0xd9eefc), metalness: 0, roughness: .06, transparent: true, opacity: .58, envMapIntensity: 1.6});
    o.material.needsUpdate = true;
  });
  {
    let body = null, vol = 0; const size = new THREE.Vector3();
    for (const g of parts.DUT || []) g.traverse(o => { if (!o.isMesh) return; o.geometry.computeBoundingBox(); o.geometry.boundingBox.getSize(size); const v = size.x * size.y * size.z; if (v > vol) { vol = v; body = o; } });
    if (body) { Object.assign(body.material, {color: new THREE.Color(0x4b525d), metalness: .72, roughness: .16, envMapIntensity: 1.2}); body.material.needsUpdate = true; }
  }

  // ---- 後製：多重取樣 HDR → 原有 SSAO（接觸陰影）→ 暗角與抖色 → 色調映射 ----
  // 顯示卡較弱時自動降解析度：連續慢幀（35–200 ms；更長的是分頁在背景被節流，不算）就把上限往下調
  let prLimit = 1.5, slow = 0, lastFrame = 0;
  const prCap = () => Math.min(prLimit, renderer.getPixelRatio());
  const watchFrame = (now) => {
    const dt = now - lastFrame; lastFrame = now;
    if (dt > 35 && dt < 200) slow++; else if (dt <= 35) slow = Math.max(0, slow - 1);
    if (slow > 45 && prLimit > 1) { prLimit = Math.max(1, prLimit - .5); slow = 0; syncComposer(); }
  };
  const target = new THREE.WebGLRenderTarget(1, 1, {type: THREE.HalfFloatType, samples: 4});
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  surfaceAO.renderToScreen = false;
  class ContactShade extends Pass {
    constructor() { super(); this.needsSwap = false; }
    render(r, write, read) {
      if (iso) return;
      const hidden = []; if (floor.visible) { hidden.push(floor); floor.visible = false; }
      for (const m of pickables) if (m.visible && !Array.isArray(m.material) && m.material.transparent && m.material.opacity < .5) { hidden.push(m); m.visible = false; }
      surfaceAO.render(r, null, read); for (const m of hidden) m.visible = true;
    }
  }
  composer.addPass(new ContactShade());
  const grade = new ShaderPass({
    uniforms: {tDiffuse: {value: null}, uVig: {value: .3}, uTime: {value: .37}},
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D tDiffuse;uniform float uVig,uTime;varying vec2 vUv;
      float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+uTime)*43758.5453);}
      void main(){vec4 c=texture2D(tDiffuse,vUv);vec2 d=(vUv-.5)*vec2(1.,.82);
        c.rgb*=mix(1.-uVig,1.,smoothstep(.78,.18,length(d)));
        c.rgb+=(h(gl_FragCoord.xy)-.5)*.004;gl_FragColor=c;}`,
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  const syncComposer = () => {
    const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
    composer.setPixelRatio(prCap()); composer.setSize(w, h);
  };
  const baseResize = resize;
  resize = function () { baseResize(); syncComposer(); };
  addEventListener('resize', syncComposer);
  syncComposer();
  // 畫布本身最多 2 倍（簡報送來的 dpr 可到 2.5，後製只算到 1.5 倍，畫布再大只是白費填色）
  const setPR = renderer.setPixelRatio.bind(renderer);
  renderer.setPixelRatio = v => setPR(Math.min(2, v));
  renderer.setPixelRatio(renderer.getPixelRatio());

  // ---- 省效能：只在畫面真的會變時才畫 ----
  // 原本每一幀都重畫整個場景＋陰影＋SSAO＋後製，閒置時也一樣，而且簡報裡最多同時開三個機台 iframe。
  // 改成：iframe 不在畫面上就不畫；鏡頭、零件位置、透明度、發光有變，或剛收到簡報指令／滑鼠操作，才畫。
  // 陰影只跟零件位置有關（跟鏡頭無關），所以只在零件動的時候更新。
  let active = true, lastEvent = performance.now(), lastSig = NaN, lastCam = NaN, lastDraw = 0;
  const poke = () => { lastEvent = performance.now(); };
  // 同一個指令內容沒變（例如暫停時重送同一組 pose）就不算變化
  const lastMsg = new Map();
  addEventListener('message', e => {
    const d = e.data; if (!d || d.ns !== 'platform') return;
    if (d.cmd === 'active') { active = !!d.on; if (active) poke(); return; }
    const key = JSON.stringify(d); if (lastMsg.get(d.cmd) === key) return; lastMsg.set(d.cmd, key);
    poke(); renderer.shadowMap.needsUpdate = true;
  });
  for (const ev of ['pointerdown', 'pointermove', 'wheel', 'pointerup']) renderer.domElement.addEventListener(ev, poke, {passive: true});
  addEventListener('resize', poke);
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  const partSig = () => {
    let s = exT * 5 + glow.material.opacity + M.wg.emissiveIntensity;
    for (const k in M) { const o = M[k]; if (o && o.isObject3D) { const p = o.position, r = o.rotation; s += p.x * 1.3 + p.y * 1.7 + p.z * 2.1 + r.x * 3.1 + r.y * 3.7 + r.z * 4.3; } }
    for (const k in MOD) s += MOD[k].t * 7;
    for (const g of leaf) { const u = g.userData; s += u.ta * .37 + (u.pulse > 0 ? u.pulse : 0) * .53 + (g.visible ? .11 : 0); }
    return s;
  };
  const camSig = () => { const e = camera.matrixWorld.elements; let s = camera.aspect * 9; for (let i = 0; i < 16; i++) s += e[i] * (i + 1); return s; };
  let drewThisFrame = false;
  // 第一次繪圖要編譯約 25 個著色器（實測卡住主執行緒約 0.4 s）。改成背景平行編譯，編好才開始畫
  let compiled = false;
  // 編好後先用 64×64 偷畫一張：後製、SSAO、陰影的著色器也在預載時編完（iframe 還藏著時也照做），真正換到這頁時就不會卡
  renderer.compileAsync(scene, camera).catch(() => {}).then(() => {
    const hidden = stage.clientWidth < 2 || stage.clientHeight < 2;
    if (hidden) { renderer.setSize(64, 64, false); composer.setSize(64, 64); }
    renderer.shadowMap.needsUpdate = true; composer.render();
    if (hidden) resize();
    compiled = true; poke(); renderer.shadowMap.needsUpdate = true;
  });
  renderSurfaces = function () {
    drewThisFrame = false;
    if (!compiled || !active || stage.clientWidth < 2 || stage.clientHeight < 2) return;   // 換頁瞬間 iframe 尺寸為 0，畫了只會產生 GL 錯誤
    const now = performance.now(), ps = partSig(), cs = camSig();
    const partsMoved = ps !== lastSig, busy = demo || ang || fly || TOUR.on || now - lastEvent < 400;
    if (!partsMoved && cs === lastCam && !busy && now - lastDraw < 2000) return;
    if (partsMoved) renderer.shadowMap.needsUpdate = true;
    lastSig = ps; lastCam = cs; lastDraw = now; drewThisFrame = true;
    watchFrame(now); composer.render();
  };
  // CSS 標籤也跟著：沒重畫就不用重排
  const labelRender = labelR.render.bind(labelR);
  labelR.render = (s, c) => { if (drewThisFrame) labelRender(s, c); };
}
