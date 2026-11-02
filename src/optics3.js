// 三種「透鏡放在哪一層」的光路（長度 µm）。3D 光路場景與「光纖對光纖」分頁共用。
//
// 沿 Z 分三層：第 1 層＝光纖端面、第 2 層＝自由空間、第 3 層＝晶片端面。
// 每一段都是同一個高斯光束 w(z) = w0·√(1+((z−zw)/zR)²)，zR = π·n·w0²/λ；
// 薄透鏡只改波前曲率、不改當下的光束半徑，所以透鏡前後兩段在透鏡位置的 w 相等，
// 由此反推透鏡後的光腰位置（光腰大小取 SSC 模場）。數值是示意值，不是實機規格。
import { LAMBDA } from './physics.js';

export const W_SMF = 5.2;      // SMF-28 模場半徑（MFD 10.4 µm）
export const W_SSC = 1.5;      // SSC 模場半徑（約 3×3 µm，文獻代表值）
export const N_CHIP = 1.45;    // 晶片側（SiO₂ 包層）折射率，示意

export const zR = (w0, n = 1) => (Math.PI * n * w0 * w0) / LAMBDA;
export const gw = (w0, zw, z, n = 1) => w0 * Math.sqrt(1 + ((z - zw) / zR(w0, n)) ** 2);
// 已知透鏡處光束半徑 wl，求光腰 w0 的光束要離透鏡多遠（光腰在透鏡之後）
const waistDist = (wl, w0, n = 1) => zR(w0, n) * Math.sqrt(Math.max(0, (wl / w0) ** 2 - 1));

function build(id) {
  if (id === 'lensed') {
    // 透鏡光纖：光纖尖端的錐形段把模場擴到約 10 µm，尖端曲面就是透鏡（第 1 層）
    const wTip = 10, d2 = waistDist(wTip, W_SSC);
    return {
      id, layer: 1, name: '透鏡光纖', tag: 'A', lensZ: 0, zc: d2, zWaist: d2, wTip, taper: 70,
      lensName: '光纖尖端（透鏡光纖）',
      say: '尖端磨成透鏡，光聚在端面外約 30 µm',
      w(z) {
        if (z < -this.taper) return W_SMF;
        if (z < 0) { const u = (z + this.taper) / this.taper; return W_SMF + (wTip - W_SMF) * u * u * (3 - 2 * u); }
        if (z <= d2) return gw(W_SSC, d2, z);
        return W_SSC;
      },
    };
  }
  if (id === 'freelens') {
    // 一般平切光纖＋固定在空間中的透鏡（第 2 層）
    const L1 = 300, wl = gw(W_SMF, 0, L1), d2 = waistDist(wl, W_SSC), zc = L1 + d2;
    return {
      id, layer: 2, name: '一般光纖＋固定透鏡', tag: 'B', lensZ: L1, zc, zWaist: zc, wl,
      lensName: '固定在空間中的透鏡',
      say: '中間放一顆固定透鏡，光纖與透鏡都要對',
      w(z) {
        if (z < 0) return W_SMF;
        if (z <= L1) return gw(W_SMF, 0, z);
        if (z <= zc) return gw(W_SSC, zc, z);
        return W_SSC;
      },
    };
  }
  // 'chiplens'：PIC 端面上有透鏡（第 3 層），光在晶片內聚焦進 SSC
  const Lc = 150, wl = gw(W_SMF, 0, Lc), d2 = waistDist(wl, W_SSC, N_CHIP), zw = Lc + d2;
  return {
    id, layer: 3, name: 'PIC 上有透鏡', tag: 'C', lensZ: Lc, zc: Lc, zWaist: zw, wl,
    lensName: '晶片端面上的微透鏡',
    say: '微透鏡做在晶片端面，把發散光收進 SSC',
    w(z) {
      if (z < 0) return W_SMF;
      if (z <= Lc) return gw(W_SMF, 0, z);
      if (z <= zw) return gw(W_SSC, zw, z, N_CHIP);
      return W_SSC;
    },
  };
}

export const CASE_IDS = ['lensed', 'freelens', 'chiplens'];
export const CASES = Object.fromEntries(CASE_IDS.map((id) => [id, build(id)]));
// 平切光纖對平切光纖（我的 Z 軸模場）：兩端同一個模場，沒有透鏡
export const F2F = {
  id: 'f2f', layer: 0, name: '光纖對光纖（Z 軸模場）', tag: '0', lensZ: null, zc: 100, zWaist: 0,
  say: '兩端都是 SMF-28，光腰在光纖端面上；間隙 Z 越大，光斑越大、峰值越低。',
  w(z) { return z < 0 ? W_SMF : gw(W_SMF, 0, z); },
};
export const LAYER_NAMES = ['第 1 層：光纖端面', '第 2 層：自由空間', '第 3 層：晶片端面'];
