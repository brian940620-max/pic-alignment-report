// 8 通道透鏡光纖陣列 → PIC 邊緣耦合器：FA8_Lensed_PIC（MATLAB v1.0）的 JS 移植。
// 單通道：StAmant_XYZ_Field/physics/overlapPose.m 的閉式六軸重疊積分（切割角 0）；
// 陣列：FA8_Lensed_PIC/etaFA.m 的剛體轉換。check_fa8.mjs 用 MATLAB 匯出的數字逐項核對。
// 座標＝晶片座標：端面 z = 0，第 k 個耦合器在 (u_k, 0, 0)；x 沿陣列，y 垂直晶片面。
// FA 姿態 [X Y Z tx ty tz]：X、Y＝旋轉中心的平移，Z＝旋轉中心到端面的間距；
// 三個角度共用一個旋轉中心（尖端平面上，px），R = Ry·Rx·Rz（同 poseGeometry.m）。
// 第 k 通道尖端 P_k = [px+X, Y, Z] + R·[u_k+ex−px, ey, ez]，光腰 W_k = P_k − WD·R·e_z。

export const FA8 = {
  nCh: 8, pitch: 127, lambda: 1.55, n: 1.0,
  wf: 1.5,                // 透鏡光斑半徑 µm（MFD 3.0 標稱；Chen 2026 依實際尖端 FDTD 模擬約 2.6）
  WD: 14,                 // 工作距離 µm（假設值）
  wChip: [1.5, 1.25],     // 晶片模場半徑 [x y] µm（SOI 反向錐 MFD 3.0×2.5；Marchetti 2019、Xu 2023）
};

const chU = (p) => Array.from({ length: p.nCh }, (_, k) => (k - (p.nCh - 1) / 2) * p.pitch);
export const pivotX = (p, pivot) => (typeof pivot === 'number' ? pivot : pivot === 'ch1' ? chU(p)[0] : 0);

// 旋轉矩陣 R = Ry(ty)·Rx(tx)·Rz(tz)（poseGeometry.m）
export function rotR(tx, ty, tz) {
  const cx = Math.cos(tx), sx = Math.sin(tx), cy = Math.cos(ty), sy = Math.sin(ty), cz = Math.cos(tz), sz = Math.sin(tz);
  return [
    [cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx],
    [cx * sz, cx * cz, -sx],
    [-sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx],
  ];
}

// overlapPose.m（切割角 0）：發射端＝晶片模場，光腰在 z = 0；接收端＝光腰在 (X, Y, Z) 的高斯，方向 d、繞自身軸轉 tz
// Z 可為負（光腰虛擬地在端面後方）：兩道自由空間高斯光束的重疊與取哪個平面無關。
export function overlapPose(X, Y, Z, tx, ty, tz, w1, w2, lambda = 1.55, n = 1) {
  const k = 2 * Math.PI * n / lambda, q = lambda / (Math.PI * n);
  // ax = 1/(w1x² + i q Z)
  const inv = (a, b) => { const d = a * a + b * b; return [a / d, -b / d]; };
  const ax = inv(w1[0] ** 2, q * Z), ay = inv(w1[1] ** 2, q * Z);
  const c = Math.cos(tz), s = Math.sin(tz), ux = 1 / w2[0] ** 2, uy = 1 / w2[1] ** 2;
  const B11 = c * c * ux + s * s * uy, B22 = s * s * ux + c * c * uy, B12 = c * s * (ux - uy);
  const dx = Math.cos(tx) * Math.sin(ty), dy = -Math.sin(tx);
  const M11 = [ax[0] + B11, ax[1]], M22 = [ay[0] + B22, ay[1]], M12 = B12;
  const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const det = mul(M11, M22); det[0] -= M12 * M12;
  const j1 = [2 * (B11 * X + B12 * Y), -k * dx], j2 = [2 * (B12 * X + B22 * Y), -k * dy];
  const t1 = mul(M22, mul(j1, j1)), t2 = mul(j1, j2), t3 = mul(M11, mul(j2, j2));
  const num = [t1[0] - 2 * M12 * t2[0] + t3[0], t1[1] - 2 * M12 * t2[1] + t3[1]];
  const dd = det[0] ** 2 + det[1] ** 2, Qre = (num[0] * det[0] + num[1] * det[1]) / dd;   // Re(num/det)
  const c0 = -(B11 * X * X + 2 * B12 * X * Y + B22 * Y * Y);
  const nrm = Math.sqrt(16 * ax[0] * ay[0] * ux * uy);
  return nrm / Math.sqrt(dd) * Math.exp(2 * (Qre / 4 + c0));
}

// etaFA.m：pose = [X Y Z tx ty tz]；inst = 製造誤差 {ex, ey, ez, wf, WD}（陣列，省略＝理想 FA）
// 回傳每個通道：u（標稱 x）、ox, oy（光腰相對自己耦合器的橫向偏移）、wz（光腰 z）、gap（尖端 z）、e（η）
export function etaFA(pose, p = FA8, pivot = 'center', inst = null) {
  const [X, Y, Z, tx, ty, tz] = pose, u = chU(p), px = pivotX(p, pivot), R = rotR(tx, ty, tz);
  return u.map((uk, k) => {
    const ex = inst ? inst.ex[k] : 0, ey = inst ? inst.ey[k] : 0, ez = inst ? inst.ez[k] : 0;
    const wf = inst ? inst.wf[k] : p.wf, WD = inst ? inst.WD[k] : p.WD;
    const cv = [uk + ex - px, ey, ez];
    const P = [0, 1, 2].map((i) => [px + X, Y, Z][i] + R[i][0] * cv[0] + R[i][1] * cv[1] + R[i][2] * cv[2]);
    const W = [0, 1, 2].map((i) => P[i] - WD * R[i][2]);
    const e = overlapPose(W[0] - uk, W[1], W[2], tx, ty, tz, p.wChip, [wf, wf], p.lambda, p.n);
    return { u: uk, ox: W[0] - uk, oy: W[1], wz: W[2], gap: P[2], e };
  });
}

// 透鏡光束打到晶片端面（z = 0）的樣子（顯示用）：沿光軸 −d 從光腰走 s = wz/dz 到端面，
// 中心 (ox − s·dx, oy − s·dy)，光斑半徑 w = wf·√(1+(s/zR)²)；忽略斜入射造成的橢圓（tilt ≤ 3° 時 < 0.2%）。
// 光強度 I = (wf/w)²·exp(−2r²/w²)，1＝對準時（光腰剛好在端面）的峰值。
export function facetSpot(ch, pose, p = FA8) {
  const R = rotR(pose[3], pose[4], pose[5]), d = [R[0][2], R[1][2], R[2][2]], s = ch.wz / d[2];
  const zR = Math.PI * p.n * p.wf * p.wf / p.lambda, w = p.wf * Math.sqrt(1 + (s / zR) ** 2);
  return { cx: ch.ox - s * d[0], cy: ch.oy - s * d[1], w, s, zR, I0: (p.wf / w) ** 2 };
}

// 標稱（對準）效率：模態失配上限
export const peakFA = (p = FA8) => p.wChip.reduce((a, w) => a * (2 * w * p.wf) / (w * w + p.wf * p.wf), 1);

// 1 dB 容差：axis 0–5（X Y Z µm、tx ty tz rad），worst＝陣列最差通道，否則單通道（nCh = 1）
export function tol1dB(axis, worst = true, p = FA8, pivot = 'center') {
  const q = worst ? p : { ...p, nCh: 1 }, base = [0, 0, p.WD, 0, 0, 0], ref = 10 * Math.log10(peakFA(p)) - 1;
  const f = (v) => { const ps = base.slice(); ps[axis] += v; return 10 * Math.log10(Math.min(...etaFA(ps, q, pivot).map((c) => c.e))); };
  let lo = 0, hi = axis < 3 ? 13 : 0.26;                  // 角度上限 15°
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (f(m) > ref) lo = m; else hi = m; }
  return lo;
}
