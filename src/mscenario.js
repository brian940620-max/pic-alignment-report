// ⑤ 對位平台的實機時間軸（3+3+6：XYZ 粗動 3 軸＋角度粗動 3 軸＋6 軸奈米壓電）。長度 µm、角度 rad。
// 狀態分三組：coarse＝粗動與角度台（dx、dy、gap、tx、ty、tz），piezo＝壓電相對它起點的位移（x、y、z 往晶片為正、tx、ty、tz），
// rel＝光纖相對目標的實際姿態（coarse＋piezo）。角度命名照旋轉軸：tx＝繞垂直軸（θy 偏擺）、ty＝繞橫軸（θx 俯仰）、tz＝繞光軸（θz 滾轉）。
// 階段 1、2 的運動曲線與起終點是示意值；階段 3 的 XYZ 軌跡、功率與時間照搬進度報告同一次模擬（zrun.json，光纖對光纖、目標間距 10 µm），
// 最後的角度微調是示意（那次模擬只含 XYZ）。
import { buildZRun, zState, ZT, ZSTEPS, ZCOL } from './zanim.js';
import { chans, PEAK as FA_PEAK, S as FA } from './pages/fa_pic.js';
import { ease, lerp, clamp, DEG } from './ui.js';

export const SCOL = ['#3b6ea8', '#7048c9', '#e8590c'];
const AX = ['dx', 'dy', 'gap', 'tx', 'ty', 'tz'];
const mix = (a, b, f) => Object.fromEntries(AX.map((k) => [k, lerp(a[k], b[k], f)]));
const noise = (k) => { const s = Math.sin(k * 12.9898) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };

// 12 軸的名稱、零件（報價網頁編號）、從狀態取值
export const AXES = [
  { g: 0, name: 'X 橫向', part: 'R1', get: (s) => s.coarse.dx, u: 'um' },
  { g: 0, name: 'Y 垂直', part: 'R2', get: (s) => s.coarse.dy, u: 'um' },
  { g: 0, name: 'Z 間距', part: 'R1', get: (s) => s.coarse.gap, u: 'um' },
  { g: 1, name: 'θx 俯仰', part: 'R5', get: (s) => s.coarse.ty, u: 'rad' },
  { g: 1, name: 'θy 偏擺', part: 'R6', get: (s) => s.coarse.tx, u: 'rad' },
  { g: 1, name: 'θz 滾轉', part: 'R5', get: (s) => s.coarse.tz, u: 'rad' },
  { g: 2, name: 'X', part: 'R3', get: (s) => s.piezo.x, u: 'um' },
  { g: 2, name: 'Y', part: 'R3', get: (s) => s.piezo.y, u: 'um' },
  { g: 2, name: 'Z', part: 'R3', get: (s) => s.piezo.z, u: 'um' },
  { g: 2, name: 'θx', part: 'R3', get: (s) => s.piezo.ty, u: 'rad' },
  { g: 2, name: 'θy', part: 'R3', get: (s) => s.piezo.tx, u: 'rad' },
  { g: 2, name: 'θz', part: 'R3', get: (s) => s.piezo.tz, u: 'rad' },
];
export const GROUPS = ['粗動 3 軸（駿河電動滑台）', '角度粗動 3 軸（旋轉台＋雙層測角台）', '6 軸奈米壓電'];

const Z0 = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0 };
const relOf = (c, p) => ({ dx: c.dx + p.x, dy: c.dy + p.y, gap: c.gap - p.z, tx: c.tx + p.tx, ty: c.ty + p.ty, tz: c.tz + p.tz });

// ===================== 單通道：透鏡光纖對 PIC =====================
export function buildMachineRun() {
  const run = buildZRun(), R = ZT.run;
  const zt0 = ZT.T1 + ZT.T2, zDur = ZT.T3 + 2 * ZT.HOLD + ZT.T4;          // 進度報告動畫的精對位段（28 s）
  const fin = zState(run, zt0 + zDur).cur;
  const A = { dx: 24000, dy: 4500, gap: 48000, tx: 3.0 * DEG, ty: -2.5 * DEG, tz: 2.0 * DEG };   // 行程最遠處
  const B = { dx: 300, dy: -220, gap: 650, tx: 0.6 * DEG, ty: -0.5 * DEG, tz: 0.4 * DEG };          // 粗動完：進相機視野
  const C = { dx: -R.cx, dy: -R.cy, gap: R.gTrue0, tx: 0.25 * DEG, ty: -0.18 * DEG, tz: 0.12 * DEG }; // 相機完＝zrun 起點
  const ML_BIAS = { dx: R.cx, dy: R.cy, gap: R.standoff - R.gTrue0 };                                // 相機的系統誤差：以為已對到 (0,0,80)
  // 階段 1：一次動一組，鏡頭跟著那組零件
  const S1 = [
    { name: '粗動 X：橫向移到晶片前', part: ['R1'], keys: ['dx'], dur: 2.6, cam: 'stack' },
    { name: '粗動 Y：升降台調高度', part: ['R2'], keys: ['dy'], dur: 2.2, cam: 'stack' },
    { name: '角度粗動 θy：旋轉台把光纖轉正', part: ['R6'], keys: ['tx'], dur: 2.2, cam: 'angle' },
    { name: '角度粗動 θx、θz：雙層測角台', part: ['R5'], keys: ['ty', 'tz'], dur: 2.6, cam: 'angle' },
    { name: '粗動 Z：靠近晶片，停在相機視野內', part: ['R1'], keys: ['gap'], dur: 3.4, cam: 'approach' },
  ];
  let acc = 0; for (const s of S1) { s.t0 = acc; acc += s.dur; }
  const t1 = acc, SHOT = 3.4, SNAP = 1.0, t2 = t1 + 3 * SHOT, PRE = 1.5, t3z = t2 + PRE, t3a = t3z + zDur, TRIM = 3, t3 = t3a + TRIM + 2;
  const rem = [1, 0.3, 0.06, 0];
  const piezoAt = (cur) => ({ x: cur.x, y: cur.y, z: R.gTrue0 - cur.z, tx: 0, ty: 0, tz: 0 });
  const PF = { ...piezoAt(fin), tx: -C.tx, ty: -C.ty, tz: -C.tz };     // 壓電最後的位置（顯示放大用的基準）
  const stages = [
    { id: 1, name: '階段 1：粗動＋角度粗動，把光纖送進相機視野', short: '粗動', color: SCOL[0], t0: 0, t1 },
    { id: 2, name: '階段 2：上視＋側視相機拍照，ML 估位置，粗動修正', short: '相機＋ML', color: SCOL[1], t0: t1, t1: t2 },
    { id: 3, name: '階段 3：6 軸壓電精對位（進度報告的演算法）', short: '壓電精對位', color: SCOL[2], t0: t2, t1: t3 },
  ];
  const steps3 = [...ZSTEPS.map((n, i) => ({ name: n, color: ZCOL[i] })), { name: '角度微調（示意）', color: '#c084fc' }];

  function at(t) {
    t = clamp(t, 0, t3);
    let stage, coarse, piezo = Z0, step = '', part = [], cam = 'stack', snap = false, shot = -1, ml = null, zt = 0, zs = null, s3 = -1, show = 0;
    if (t < t1) {
      stage = 1; coarse = { ...A };
      for (const s of S1) {
        const f = ease((t - s.t0) / s.dur);
        for (const k of s.keys) coarse[k] = lerp(A[k], B[k], f);
        if (t >= s.t0 && t < s.t0 + s.dur) { step = s.name; part = s.part; cam = s.cam; }
      }
    } else if (t < t2) {
      stage = 2; cam = 'tip';
      const u = (t - t1) / SHOT, k = Math.min(2, Math.floor(u)), uu = (t - t1) - k * SHOT;
      snap = uu < SNAP; shot = k;
      const f = snap ? 0 : ease((uu - SNAP) / (SHOT - SNAP));
      coarse = mix(C, B, lerp(rem[k], rem[k + 1], f));
      const at0 = mix(C, B, rem[k]);                                  // 拍照當下的位置 → ML 估計（含系統誤差與一點雜訊）
      ml = { dx: at0.dx + ML_BIAS.dx + 4 * noise(k + 1), dy: at0.dy + ML_BIAS.dy + 4 * noise(k + 5), gap: at0.gap + ML_BIAS.gap + 5 * noise(k + 9),
        tilt: Math.hypot(at0.tx, at0.ty) / DEG + 0.2 * noise(k + 13), pose: at0 };
      step = snap ? `第 ${k + 1} 次拍照：ML 估計位置與傾角` : `第 ${k + 1} 次修正：粗動與角度台依 ML 估計移動`;
      part = snap ? ['R18'] : ['R1', 'R2', 'R5', 'R6'];
    } else {
      stage = 3; coarse = { ...C }; cam = 'couple'; part = ['R3'];
      if (t < t3z) { show = ease((t - t2) / PRE); step = '壓電接手：粗動與角度台鎖住不動（以下壓電位移放大顯示）'; zs = zState(run, zt0); zt = zt0; }
      else {
        show = 1; zt = Math.min(zt0 + (t - t3z), zt0 + zDur); zs = zState(run, zt);
        piezo = piezoAt(zs.cur || fin);
        if (t < t3a) { s3 = Math.max(0, zs.ph - 1); step = `${s3 + 1}. ${ZSTEPS[s3]}`; }
        else {
          const f = ease((t - t3a) / TRIM); s3 = 5;
          piezo = { ...piezoAt(fin), tx: -C.tx * f, ty: -C.ty * f, tz: -C.tz * f };
          step = f < 1 ? '6. 壓電三個角度軸微調傾角（繞光纖端面轉，示意）' : '精對位完成';
        }
      }
    }
    const rel = relOf(coarse, piezo);
    const db = zs && zs.db !== null && zs.db !== undefined ? zs.db : null;
    return { t, stage, step, part, cam, coarse, piezo, rel, snap, shot, ml, zt, zs, s3, show, db, lit: db !== null,
      errUm: Math.hypot(rel.dx, rel.dy, rel.gap - 10), tiltDeg: Math.hypot(rel.tx, rel.ty) / DEG };
  }
  // 給 3D 機台的姿態（mm、rad）。粗動照真實尺寸；壓電放大 AMP 倍（角度 10 倍），相對壓電的終點，所以結束時剛好回到真實位置
  const AMP = 200;
  function machinePose(s) {
    const c = s.coarse, p = s.piezo, k = s.show * AMP / 1000, ka = s.show * 10;
    return {
      cz: 0.5 - c.gap / 1000, cx: c.dx / 1000, cy: c.dy / 1000, yaw: c.tx, pitch: c.ty, roll: c.tz,
      pz: k * (p.z - PF.z), py: k * (p.y - PF.y), px: k * (p.x - PF.x),
      ptx: ka * (p.tx - PF.tx), pty: ka * (p.ty - PF.ty), ptz: ka * (p.tz - PF.tz),
      power: s.db === null ? 0 : clamp(Math.pow(10, s.db / 10), 0, 1),
    };
  }
  return { total: t3, stages, steps3, at, machinePose, run, AMP, zt0, zDur, S1, t1, t2, t3z, t3a };
}

// ===================== 陣列：8 通道 FA 對 PIC =====================
// 通道效率用 ④ 的模型（fa_pic.js：UHNA 陣列 → SSC、旋轉中心在第 1 通道）。全段示意；功率由模型算。
export function buildFARun(config = FA) {
  const A = { dx: 18000, dy: 3500, gap: 40000, tx: 2.5 * DEG, ty: -2 * DEG, tz: 1.5 * DEG };
  const B = { dx: 260, dy: -180, gap: 600, tx: 0.5 * DEG, ty: -0.4 * DEG, tz: 0.6 * DEG };
  const C = { dx: 14, dy: -11, gap: 45, tx: 0.15 * DEG, ty: -0.1 * DEG, tz: 0.3 * DEG };   // 相機完：θz 還差 0.3°、θy 0.15°
  const T1 = 7, SHOT = 3, t2 = T1 + 3 * SHOT, PRE = 1.2;
  const P3 = [
    { name: '第 1 通道：壓電 XY 繞圈梯度找峰值', dur: 5 },
    { name: '壓電 Z 靠近到 2 µm，XY 跟著修正', dur: 3 },
    { name: '壓電 θz：繞第 1 通道轉，掃第 8 通道的功率峰值', dur: 6 },
    { name: '壓電 θy：讓兩端間距一致', dur: 3 },
    { name: '檢查：第 1、8 通道都在峰值 1 dB 內 → 成功', dur: 3 },
  ];
  let acc = t2 + PRE; for (const s of P3) { s.t0 = acc; acc += s.dur; }
  const total = acc;
  const rem = [1, 0.3, 0.07, 0];
  const stages = [
    { id: 1, name: '階段 1：粗動＋角度粗動', short: '粗動', color: SCOL[0], t0: 0, t1: T1 },
    { id: 2, name: '階段 2：相機拍 FA 與晶片，ML 估位置', short: '相機＋ML', color: SCOL[1], t0: T1, t1: t2 },
    { id: 3, name: '階段 3：6 軸壓電，先第 1 通道、再轉 θz 找第 8 通道', short: '壓電精對位', color: SCOL[2], t0: t2, t1: total },
  ];
  const G = 2;                                        // 最後的間距（µm）
  // 階段 3 的壓電位移（相對粗動終點 C）：第 1 通道 XY → Z → θz（掃過峰值再回來）→ θy
  function piezoAt(t) {
    const p = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0 };
    const f = (i) => clamp((t - P3[i].t0) / P3[i].dur, 0, 1);
    const fx = f(0), fz = f(1), fr = f(2), fy = f(3);
    // XY：繞圈逼近（半徑隨距離縮小）
    const e = ease(fx), r = 2.2 * (1 - e) * Math.sin(Math.PI * Math.min(1, fx * 1.1)), th = fx * 7 * 2 * Math.PI;
    p.x = -C.dx * e + r * Math.cos(th); p.y = -C.dy * e + r * Math.sin(th);
    p.z = (C.gap - G) * ease(fz);
    // θz：先轉過頭 30%，再回到峰值
    const o = fr < 0.7 ? 1.3 * ease(fr / 0.7) : 1.3 - 0.3 * ease((fr - 0.7) / 0.3);
    p.tz = -C.tz * o; p.tx = -C.tx * ease(fy); p.ty = -C.ty * ease(fy);
    return p;
  }
  function at(t) {
    t = clamp(t, 0, total);
    let stage, coarse, piezo = { ...Z0 }, step = '', part = [], cam = 'stack', snap = false, shot = -1, ml = null, show = 0, s3 = -1;
    if (t < T1) { stage = 1; coarse = mix(B, A, 1 - ease(t / T1)); step = '粗動與角度台一起移動，FA 送進相機視野'; part = ['R1', 'R2', 'R5', 'R6']; cam = t < T1 * 0.5 ? 'all' : 'stack'; }
    else if (t < t2) {
      stage = 2; cam = 'tip';
      const k = Math.min(2, Math.floor((t - T1) / SHOT)), uu = t - T1 - k * SHOT; snap = uu < 0.9; shot = k;
      coarse = mix(C, B, lerp(rem[k], rem[k + 1], snap ? 0 : ease((uu - 0.9) / (SHOT - 0.9))));
      const at0 = mix(C, B, rem[k]);
      ml = { dx: at0.dx - C.dx + 3 * noise(k + 2), dy: at0.dy - C.dy + 3 * noise(k + 6), gap: at0.gap - C.gap + 50 + 5 * noise(k + 3), roll: (at0.tz - C.tz) / DEG, pose: at0 };
      step = snap ? `第 ${k + 1} 次拍照：ML 估 FA 位置` : `第 ${k + 1} 次修正`; part = snap ? ['R18'] : ['R1', 'R2', 'R5', 'R6'];
    } else {
      stage = 3; coarse = { ...C }; cam = 'faTop'; part = ['R3'];
      if (t < P3[0].t0) { show = ease((t - t2) / PRE); step = '壓電接手：粗動與角度台鎖住（以下壓電位移放大顯示）'; }
      else { show = 1; piezo = piezoAt(t); s3 = P3.findIndex((s) => t < s.t0 + s.dur); if (s3 < 0) s3 = P3.length - 1; step = `${s3 + 1}. ${P3[s3].name}`; }
    }
    const rel = relOf(coarse, piezo);
    // 通道效率：旋轉中心在第 1 通道；θy 讓各通道間距不同
    const ch = chans({ dx: rel.dx, dy: rel.dy, g0: rel.gap, thz: rel.tz, thy: rel.tx, pivot: { x: 0, y: 0 } }, config).map((c) => ({ ...c, db: 10 * Math.log10(Math.max(c.e / FA_PEAK, 1e-9)) }));
    return { t, stage, step, part, cam, coarse, piezo, rel, snap, shot, ml, show, s3, ch, lit: stage === 3 && ch[0].db > -40 };
  }
  const PF = piezoAt(total), AMP = 200;
  function machinePose(s) {
    const c = s.coarse, p = s.piezo, k = s.show * AMP / 1000, ka = s.show * 10;
    return {
      cz: 0.5 - c.gap / 1000, cx: c.dx / 1000, cy: c.dy / 1000, yaw: c.tx, pitch: c.ty, roll: c.tz,
      pz: k * (p.z - PF.z), py: k * (p.y - PF.y), px: k * (p.x - PF.x),
      ptx: ka * (p.tx - PF.tx), pty: ka * (p.ty - PF.ty), ptz: ka * (p.tz - PF.tz), power: 0,
    };
  }
  return { total, stages, steps3: P3, at, machinePose, AMP, N: () => config.N, P: () => config.P };
}
