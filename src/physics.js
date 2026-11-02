// 共用物理模組：高斯光束對波導模態的耦合效率（長度 µm、角度 rad）
//
// 模型（近軸、標量）：
//   光纖側：聚焦（或平切）光纖出光，光腰半徑 wf（1/e 場半徑），腰在光纖端面前方 WD 處。
//   晶片側：波導（含 SSC）模態在端面上為橢圓高斯，場半徑 wgx、wgy，平面波前。
//   光纖端面到晶片端面的間距 gap；腰到端面的距離 s = gap − WD（s>0 表示端面在腰之後）。
//   X、Y 橫向偏移；tx、ty＝光纖繞「光纖端面」的傾斜（共同旋轉中心，傾斜會讓光軸在端面上平移 gap·θ）。
// 每一軸的重疊積分是閉式解；總效率 = ηx·ηy。等模態（w1=w2）、s=0、θ=0 時回到 exp(−d²/w²)。
// 只算模態重疊，不含端面反射（反射見 fresnelLossDb）。示意值，非實機規格。

export const LAMBDA = 1.55;                 // µm
export const K0 = 2 * Math.PI / LAMBDA;     // 1/µm

// 1 維：光纖光束（半徑 w、波前曲率 q=1/R、軸在 c、軸向傾斜 th）對波導模態（半徑 w2，置於 0）
export function etaAxis(w, q, w2, c, th) {
  // α = 1/w² + 1/w2² − i·k·q/2 ；β = −2c/w2² + i·k·th
  const ar = 1 / (w * w) + 1 / (w2 * w2), ai = -K0 * q / 2;
  const br = -2 * c / (w2 * w2), bi = K0 * th;
  // β²/(4α) 的實部
  const b2r = br * br - bi * bi, b2i = 2 * br * bi;
  const den = 4 * (ar * ar + ai * ai);
  const re = (b2r * ar + b2i * ai) / den;      // Re[(b2r + i b2i)(ar − i ai)] / (4|α|²)
  const modA = Math.hypot(ar, ai);
  return (2 / (modA * w * w2)) * Math.exp(2 * re - 2 * c * c / (w2 * w2));
}

export const DEFAULTS = {
  wf: 1.5,    // 光腰半徑 µm（MFD = 2wf = 3 µm，透鏡光纖熱點 2–4 µm）
  WD: 30,     // 光纖端面到光腰 µm（Marchetti 2019：端面外 20–40 µm）
  wgx: 1.5,   // 波導（SSC）模態半徑 µm（約 3×3 µm）
  wgy: 1.5,
  nEff: 1.45, // 波導側等效折射率（只用於反射估計，示意）
};

// p：{wf, WD, wgx, wgy}；pose：{dx, dy, gap, tx, ty}（µm、rad）
export function beamAt(p, s) {
  const zR = Math.PI * p.wf * p.wf / LAMBDA;
  const w = p.wf * Math.sqrt(1 + (s / zR) ** 2);
  const q = s / (s * s + zR * zR);          // 1/R
  return { w, q, zR };
}

export function eta(p, pose) {
  const s = pose.gap - p.WD;
  const { w, q } = beamAt(p, s);
  const cx = pose.dx + pose.gap * pose.tx;   // 傾斜繞光纖端面：光軸在端面上平移 gap·θ
  const cy = pose.dy + pose.gap * pose.ty;
  return etaAxis(w, q, p.wgx, cx, pose.tx) * etaAxis(w, q, p.wgy, cy, pose.ty);
}

export const toDb = (e) => (e > 1e-12 ? 10 * Math.log10(e) : -120);   // η → dB（負值＝損耗）
export const lossDb = (e) => -toDb(e);

// 端面反射（空氣 → 波導等效折射率）
export function fresnelLossDb(nEff) {
  const R = ((nEff - 1) / (nEff + 1)) ** 2;
  return -10 * Math.log10(1 - R);
}

export const OPTIMUM = (p) => ({ dx: 0, dy: 0, gap: p.WD, tx: 0, ty: 0 });

// 單一誤差造成的損耗（其他都在最佳位置）
export function lossBreakdown(p, pose) {
  const o = OPTIMUM(p);
  const base = eta(p, o);
  const only = (patch) => lossDb(eta(p, { ...o, ...patch })) - lossDb(base);
  return {
    mismatch: lossDb(base),                                  // 模場失配（最佳對位時仍有的損耗）
    lateral: only({ dx: pose.dx, dy: pose.dy }),
    axial: only({ gap: pose.gap }),
    tilt: only({ tx: pose.tx, ty: pose.ty }),
    total: lossDb(eta(p, pose)),
  };
}

// 1 dB 容差：從最佳位置出發，讓耦合效率比峰值低 1 dB 的偏移量（單邊，取正值）
export function tolerance1dB(p, axis, dropDb = 1) {
  const o = OPTIMUM(p);
  const peak = eta(p, o);
  const target = peak * Math.pow(10, -dropDb / 10);
  const f = (v) => {
    const pose = { ...o };
    if (axis === 'x') pose.dx = v;
    else if (axis === 'y') pose.dy = v;
    else if (axis === 'z') pose.gap = p.WD + v;
    else if (axis === 'tx') pose.tx = v;
    else if (axis === 'ty') pose.ty = v;
    return eta(p, pose) - target;
  };
  const maxV = axis === 'tx' || axis === 'ty' ? 0.6 : 400;   // rad 或 µm 的搜尋上限
  let lo = 0, hi = maxV;
  if (f(hi) > 0) return Infinity;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

// 預設情境（參數為文獻代表值或示意值，介面上要標示）
export const PRESETS = {
  lensedSSC: {
    id: 'lensedSSC', name: '透鏡光纖 → SSC（3 µm）',
    note: '光點約 3 µm（Carroll 2016 p.4；Marchetti 2019 p.203 為 2–4 µm），SSC 模場約 3×3 µm（Carroll 2016 p.4）',
    p: { wf: 1.5, WD: 30, wgx: 1.5, wgy: 1.5, nEff: 1.45 },
  },
  flatSSC: {
    id: 'flatSSC', name: '平切光纖 → SSC（3 µm）',
    note: 'SMF-28 模場直徑 10.4 µm，光腰就在光纖端面',
    p: { wf: 5.2, WD: 0, wgx: 1.5, wgy: 1.5, nEff: 1.45 },
  },
  smfEC: {
    id: 'smfEC', name: '平切光纖 → SiN 邊緣耦合器（6–7 µm）',
    note: '對應 Gradkowski 2024：EC 模場約 6–7 µm，水平方向較大；示意值取 7×6 µm',
    p: { wf: 5.2, WD: 0, wgx: 3.5, wgy: 3.0, nEff: 1.9 },
  },
  bareSi: {
    id: 'bareSi', name: '透鏡光纖 → 無 SSC 的矽線波導',
    note: '矽線波導 450×220 nm，模場很小（示意取 0.30×0.22 µm 半徑）',
    p: { wf: 1.5, WD: 30, wgx: 0.30, wgy: 0.22, nEff: 2.4 },
  },
};

// 把 Gaussian 光纖對波導等模態（wf=wg=5.2）用於和 StAmant_XYZ_Field 的 etaXYZ 對照
export function selfCheck() {
  const p = { wf: 5.2, WD: 0, wgx: 5.2, wgy: 5.2 };
  const rows = [];
  for (const [dx, z] of [[0, 0], [2.5, 0], [5.2, 0], [0, 20], [3, 50]]) {
    rows.push({ dx, z, eta: eta(p, { dx, dy: 0, gap: z, tx: 0, ty: 0 }) });
  }
  return rows;
}
