// 六軸光場：移動光纖（X、Y、Z＋θx 俯仰、θy 偏擺、θz 滾轉）射到固定光纖端面。長度 µm、角度 rad。
// 座標：x＝光軸（接收端面在 x=0，移動光纖尖端在 x=−Z），y＝垂直（Y），z＝水平（X）。
//   θy 偏擺：光軸在水平面轉（影響 X）；θx 俯仰：光軸在垂直面轉（影響 Y）；θz 滾轉：繞光軸轉，只有橢圓模場才看得出來。
// 端面光斑與耦合效率用數值重疊積分（含波前曲率、Gouy 相位、斜入射相位），所以傾斜、滾轉、橢圓都能算。
// 場切片 η(X,Y,Z) 用各軸閉式解（physics.js 的 etaAxis，不含滾轉）。
import { LAMBDA, K0, etaAxis } from './physics.js';

const zr = (w) => (Math.PI * w * w) / LAMBDA;

// s：{x, y, z(=間隙 Z), tx(俯仰), ty(偏擺), tz(滾轉), wsx, wsy(光源光腰半徑), wd(光腰離光纖端面的距離，透鏡光纖約 30 µm), wrx, wry(接收端)}
function frame(s) {
  const T = [-s.z, s.y, s.x];
  // 方向：先偏擺（水平）再俯仰（垂直）
  const cy = Math.cos(s.ty), sy = Math.sin(s.ty), cp = Math.cos(s.tx), sp = Math.sin(s.tx);
  const d = [cp * cy, sp, cp * sy];
  // 橫向基底：a 偏水平、b 偏垂直，再繞光軸滾轉 tz
  let a = [-sy, 0, cy];
  let b = [d[1] * a[2] - d[2] * a[1], d[2] * a[0] - d[0] * a[2], d[0] * a[1] - d[1] * a[0]];
  const cr = Math.cos(s.tz), sr = Math.sin(s.tz);
  const a2 = a.map((v, i) => cr * v + sr * b[i]), b2 = b.map((v, i) => -sr * a[i] + cr * v);
  return { T, d, a: a2, b: b2 };
}

// 端面（x=0）上的光場；回傳 {I（強度陣列，N×N，列＝y 由上到下、行＝z 由左到右）, eta, peak:{y,z}}
export function facet(s, hw = 40, N = 161) {   // 視窗中心在接收端原點，±hw µm
  const { T, d, a, b } = frame(s);
  const zx = zr(s.wsx), zy = zr(s.wsy);
  const I = new Float32Array(N * N);
  let sr = 0, si = 0, pIn = 0, pR = 0, best = -1, py = 0, pz = 0;
  const st = (2 * hw) / (N - 1);
  for (let r = 0; r < N; r++) {
    const y = hw - r * st;
    for (let c = 0; c < N; c++) {
      const z = -hw + c * st;
      const v0 = -T[0], v1 = y - T[1], v2 = z - T[2];
      const u = v0 * d[0] + v1 * d[1] + v2 * d[2] - (s.wd || 0);   // 從光腰起算
      const pa = v0 * a[0] + v1 * a[1] + v2 * a[2], pb = v0 * b[0] + v1 * b[1] + v2 * b[2];
      const wx = s.wsx * Math.sqrt(1 + (u / zx) ** 2), wy = s.wsy * Math.sqrt(1 + (u / zy) ** 2);
      const qx = u / (u * u + zx * zx), qy = u / (u * u + zy * zy);           // 1/R
      const amp = Math.sqrt((s.wsx * s.wsy) / (wx * wy)) * Math.exp(-(pa * pa) / (wx * wx) - (pb * pb) / (wy * wy));
      const ph = -K0 * (u + 0.5 * pa * pa * qx + 0.5 * pb * pb * qy) + 0.5 * (Math.atan(u / zx) + Math.atan(u / zy));
      const er = Math.exp(-(z * z) / (s.wrx * s.wrx) - (y * y) / (s.wry * s.wry));
      const re = amp * Math.cos(ph), im = amp * Math.sin(ph);
      const ii = amp * amp;
      I[r * N + c] = ii;
      sr += re * er; si += im * er; pIn += ii; pR += er * er;
      if (ii > best) { best = ii; py = y; pz = z; }
    }
  }
  // 入射功率以斜面上的積分計（窗夠大時≈全部功率）
  return { I, N, hw, eta: (sr * sr + si * si) / (pIn * pR), peak: { y: py, z: pz } };
}

// 場切片：η(X,Y) at 間隙 Z（光纖尖端位置），固定角度；不含滾轉。列 0＝Y=+hw，行 0＝X=−hw
export function etaSlice(s, Z, hw = 30, N = 48) {
  const out = new Float32Array(N * N);
  const zx = zr(s.wsx), zy = zr(s.wsy);
  const u = Z - (s.wd || 0);                        // 透鏡光纖：光腰在尖端外 wd
  const wx = s.wsx * Math.sqrt(1 + (u / zx) ** 2), wy = s.wsy * Math.sqrt(1 + (u / zy) ** 2);
  const qx = u / (u * u + zx * zx), qy = u / (u * u + zy * zy);
  const st = (2 * hw) / (N - 1);
  const ex = [], ey = [];
  for (let k = 0; k < N; k++) { const v = -hw + k * st; ex.push(etaAxis(wx, qx, s.wrx, v + Z * Math.tan(s.ty), s.ty)); ey.push(etaAxis(wy, qy, s.wry, v + Z * Math.tan(s.tx), s.tx)); }
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) out[r * N + c] = ey[N - 1 - r] * ex[c];
  return out;
}

// 色表（暗 → 紫 → 橘 → 黃白），t∈[0,1]
export function heat(t) {
  t = Math.max(0, Math.min(1, t));
  const st = [[0, 4, 10, 30], [0.25, 60, 20, 110], [0.5, 190, 50, 90], [0.75, 255, 140, 30], [1, 255, 245, 200]];
  for (let i = 1; i < st.length; i++) if (t <= st[i][0]) {
    const [t0, r0, g0, b0] = st[i - 1], [t1, r1, g1, b1] = st[i], u = (t - t0) / (t1 - t0);
    return [r0 + (r1 - r0) * u, g0 + (g1 - g0) * u, b0 + (b1 - b0) * u];
  }
  return [255, 245, 200];
}

// 端面上單一點 (Y, X) 的入射光強（給示意圖畫輪廓用；與 facet() 同一套光束）
export function intensityAt(s, y, x) {
  const { T, d, a, b } = frame(s);
  const v0 = -T[0], v1 = y - T[1], v2 = x - T[2];
  const u = v0 * d[0] + v1 * d[1] + v2 * d[2] - (s.wd || 0);
  const pa = v0 * a[0] + v1 * a[1] + v2 * a[2], pb = v0 * b[0] + v1 * b[1] + v2 * b[2];
  const wx = s.wsx * Math.sqrt(1 + (u / zr(s.wsx)) ** 2), wy = s.wsy * Math.sqrt(1 + (u / zr(s.wsy)) ** 2);
  return ((s.wsx * s.wsy) / (wx * wy)) * Math.exp(-2 * (pa * pa) / (wx * wx) - 2 * (pb * pb) / (wy * wy));
}
// 光軸方向（與 facet 相同的定義）
export function axisDir(s) { return frame(s).d; }

// jet 色表（期刊常用），回傳 0–1 的 [r, g, b]
export function jet(t) {
  t = Math.max(0, Math.min(1, t));
  const f = (c) => Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - c)));
  return [f(3), f(2), f(1)];
}
// 類 MATLAB parula 色表（和進度報告的切片圖一致），回傳 0–255
export function parula(t) {
  t = Math.max(0, Math.min(1, t));
  const st = [[0, 62, 38, 168], [0.2, 37, 105, 245], [0.4, 18, 155, 215], [0.6, 46, 190, 145], [0.8, 190, 190, 60], [1, 249, 251, 20]];
  for (let i = 1; i < st.length; i++) if (t <= st[i][0]) { const [t0, r0, g0, b0] = st[i - 1], [t1, r1, g1, b1] = st[i], u = (t - t0) / (t1 - t0); return [r0 + (r1 - r0) * u, g0 + (g1 - g0) * u, b0 + (b1 - b0) * u]; }
  return [249, 251, 20];
}
