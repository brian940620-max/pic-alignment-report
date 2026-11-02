// 深色攝影棚環境貼圖：黑色背景＋頂部柔光箱＋左右長條燈＋暖色輪廓光。
// 給金屬、拋光矽、玻璃光纖用：反射以暗為主、只留幾道乾淨的高光（RoomEnvironment 太亮，晶片會整片發白）。
import * as THREE from 'three';

export function studioEnv(renderer, { key = 7, strip = 5, rim = 3 } = {}) {
  const env = new THREE.Scene(), quad = new THREE.PlaneGeometry(1, 1);
  const lum = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), side: THREE.DoubleSide });
  const room = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 20), [0, 1, 2, 3, 4, 5].map(i => {
    const m = lum(...(i === 2 ? [.05, .055, .065] : i === 3 ? [.012, .013, .016] : [.03, .034, .042])); m.side = THREE.BackSide; return m;
  }));
  env.add(room);
  const panel = (w, h, pos, mat) => { const m = new THREE.Mesh(quad, mat); m.scale.set(w, h, 1); m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m); };
  panel(6, 4, [0, 4.9, 0], lum(key, key * .98, key * .95));                 // 頂部柔光箱
  panel(.6, 5, [-8, 1.5, 3], lum(strip * .85, strip * .92, strip));          // 左長條燈（偏冷）
  panel(.6, 5, [8, 1.5, -3], lum(strip * .85, strip * .92, strip));          // 右長條燈
  panel(4, 1.2, [-3, .8, -9.9], lum(rim, rim * .75, rim * .5));              // 後方暖色輪廓光
  const pm = new THREE.PMREMGenerator(renderer), tex = pm.fromScene(env, .03).texture;
  pm.dispose(); env.traverse(o => { if (o.isMesh) { o.geometry.dispose(); [].concat(o.material).forEach(m => m.dispose()); } });
  return tex;
}
