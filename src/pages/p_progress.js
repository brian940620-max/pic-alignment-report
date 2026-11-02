// 分頁 ① 進度報告（封面＋6 張）：進度圖、Z 軸模場、Z 軸對位演算法、三階段規劃＋動畫、角度讓 XY 光斑變歪、六軸偏差的光斑與耦合功率
// 內容出處：進度報告_第一部分_Z軸對位.pptx（P1）、進度報告_Z軸精對位與三軸演算法.pptx（P2）、
//           進度報告_StAmant2004_XYZ場地_新版_含五軸_已補stacking.pptx（P3）、進度報告_五軸六軸_MMDD.pptx（P4）、StAmant_XYZ_Field。
// 圖檔用相對路徑（簡報要在專案資料夾內開）：Z_alignment_sim/results/、StAmant_XYZ_Field/output/figures/、互動報告/assets/。
import { h, slider, segmented, fitCanvas, DEG } from '../ui.js';
import { eta, LAMBDA } from '../physics.js';
import { Couple3D, C3D_CSS } from '../couple3d.js';
import { STAGES } from '../scenario.js';
import { facet, heat, jet } from '../field6.js';
import { Schem3D } from '../schem3d.js';
import { buildZRun, drawZ, ZSTEPS, ZCOL } from '../zanim.js';
import { tex } from '../tex.js';
import { enhanceProgress } from '../progress-presenter.js';
import { sliceView } from '../slice-view.js';

// Z 軸模場與 Z 對位兩頁共用的模型出處
const PAPER = '耦合模型出處：Y. St-Amant, D. Gariépy, D. Rancourt, “Intrinsic properties of the optical coupling between axisymmetric Gaussian beams,” Appl. Opt. 43(30), 5691–5704 (2004), doi:10.1364/AO.43.005691（高斯光束重疊積分模型）';

// 角度頁左欄的單軸閉式解（光纖繞尖端轉 th，光到端面時偏 d、光斑 w1、曲率 1/R；忽略斜入射的 cosθ）
// 和 facet() 的數值重疊積分在 5° 內差 < 0.05 dB、10° 約 1 dB
function axisEta(w0, wd, w2, Z, th) {
  const k = (2 * Math.PI) / LAMBDA, u = Z - (wd || 0), zr = (Math.PI * w0 * w0) / LAMBDA;
  const w1 = w0 * Math.sqrt(1 + (u / zr) ** 2), iR = u / (u * u + zr * zr), d = Z * Math.tan(th);
  const ar = 1 / w1 ** 2 + 1 / w2 ** 2, ai = (k * iR) / 2, br = (2 * d) / w1 ** 2, bi = k * (d * iR - th);
  const m = ar * ar + ai * ai, re = ((br * br - bi * bi) * ar + 2 * br * bi * ai) / (4 * m);   // Re(β²/4α)
  return { eta: (2 / (w1 * w2 * Math.sqrt(m))) * Math.exp(2 * re - (2 * d * d) / w1 ** 2), d, w1, R: iR ? 1 / iR : Infinity };
}

const CSS = `
.tl { position:relative; display:grid; grid-template-columns:repeat(8,1fr); gap:0; padding:30px 10px 0; }
.tl::before { content:''; position:absolute; left:4%; right:4%; top:52px; height:4px; border-radius:4px; background:linear-gradient(90deg,#ff8a3d 0%,#ffb86b 100%); box-shadow:0 0 14px rgba(255,138,61,.5); }
.tl .nd { position:relative; text-align:center; cursor:pointer; padding:0 4px; }
.tl .dot { width:30px; height:30px; margin:8px auto 10px; border-radius:50%; background:#ff8a3d; border:3px solid #ffe2c2; box-shadow:0 0 16px #ff8a3d; display:flex; align-items:center; justify-content:center; font-size:14px; color:#1a1206; font-weight:800; transition:.2s; }
.tl .nd.now .dot { background:#fff; animation:pulse 1.6s infinite; }
@keyframes pulse { 0%,100% { box-shadow:0 0 0 0 rgba(255,184,107,.7); } 50% { box-shadow:0 0 0 12px rgba(255,184,107,0); } }
.tl .dt { font-family:var(--mono); font-size:13px; color:#ffb86b; }
.tl .tt { font-size:15.5px; font-weight:700; color:#fff; line-height:1.35; margin-top:4px; }
.tl .nd.on .dot { transform:scale(1.25); } .tl .nd.on .tt { color:#ffd29a; }
.tlc { display:grid; grid-template-columns:240px 1fr; gap:22px; align-items:start; }
.tlc h2 { font-size:28px; margin:2px 0 8px; } .tlc .kv { font-family:var(--mono); font-size:34px; font-weight:800; color:#ffb86b; text-shadow:0 0 16px rgba(255,138,61,.45); }
.tlc .blk { border-left:3px solid; padding:4px 0 4px 14px; margin-bottom:12px; }
.tlc .blk b { display:block; font-size:14px; letter-spacing:1px; margin-bottom:2px; } .tlc .blk div { font-size:17px; line-height:1.55; color:#e8eefb; }
.gl { display:grid; grid-template-columns:auto 1fr; gap:3px 12px; font-size:14px; color:#dfe8fa; align-items:baseline; }
.gl b { font-family:"Cambria Math", serif; font-size:17px; color:#ffd29a; font-weight:400; text-align:right; }
.figc { padding:8px; display:flex; flex-direction:column; align-items:center; gap:4px; min-height:0; }
.figc img { flex:1; min-height:0; max-width:100%; object-fit:contain; border-radius:6px; }
.mcard { gap:6px; } .mcard h2 { margin:0; font-size:21px; } .mcard ul { padding-left:20px; margin:0; font-size:15px; line-height:1.5; }
.mcard .tex { color:var(--ink); font-size:21px; padding:2px 0; }
.st3 { display:flex; gap:10px; } .st3 > div { flex:1; border-radius:14px; padding:10px 14px; color:#fff; border:1px solid rgba(255,255,255,.18); }
.st3 b { font-size:17px; display:block; margin-bottom:2px; } .st3 span { font-size:14px; line-height:1.4; display:block; opacity:.95; }
.zsteps { display:grid; grid-template-columns:repeat(5,1fr); gap:6px; }
.zsteps span { text-align:center; font-size:13.5px; padding:5px 2px; border-radius:8px; color:#9fb3d1; border:1px solid rgba(140,170,230,.25); transition:.2s; }
.zsteps span.on { color:#0b1424; font-weight:800; }
.six .slider { margin:2px 0; } .six { display:grid; grid-template-columns:1fr 1fr; gap:2px 14px; }
.stk-t { font-size:12.5px; color:#333; font-family:system-ui, sans-serif; } .stk-t.big { font-size:14px; font-weight:700; }
.c3d.sch, .sch { position:absolute; inset:6px; border-radius:10px; overflow:hidden; }
.eqcol .eqh { color:#ffd29a; font-weight:700; font-size:13.5px; line-height:1.35; margin-top:2px; }
.eqcol .tex.xs { font-size:16px; padding:1px 0; }
.eqcol .eqlive { font-family:var(--mono); font-size:13px; line-height:1.55; color:#dfe8fa; background:rgba(8,14,28,.6); border:1px solid rgba(140,170,230,.25); border-radius:8px; padding:4px 8px; }
.eqcol .eqlive b { color:#ffb86b; }
.eqcol .slider { margin:0; }
.sch .ttl { position:absolute; left:10px; top:8px; z-index:2; font-size:15px; font-weight:700; color:#fff; background:rgba(8,14,28,.75); padding:3px 10px; border-radius:99px; }
`;

export function mount(sec, ctx) {
  let cssDone = false;
  const css = (body) => { body.closest('.slide').classList.add('progress-ui'); enhanceProgress(body); if (!cssDone) { body.append(h('style', null, CSS + C3D_CSS)); cssDone = true; } };

  // ============ 封面：只放透鏡光纖，不畫層位面板 ============
  sec.slide({ title: '', cover: true }, (body) => {
    css(body);
    const holder = h('div', { class: 'c3d', style: { position: 'absolute', inset: '0', borderRadius: '0' } });
    body.append(holder,
      h('div', { class: 'cover-txt' },
        h('div', { class: 'kicker' }, 'ML × 矽光子主動對位　｜　10-30 進度報告'),
        h('h1', null, 'PIC 邊緣耦合'),
        h('div', { class: 'lead' }, '透鏡光纖把光聚在端面外約 30 µm，送進 PIC；從 Z 軸模場、對位演算法到三階段自動對位平台')));
    const c3 = new Couple3D(holder, { caseId: 'lensed', shift: 0.32, layers: false, hq: true });
    let timer = null;
    return { show() { c3.start(); clearInterval(timer); timer = setInterval(() => c3.replay(), 9000); }, hide() { c3.stop(); clearInterval(timer); } };
  });

  // ============ 1. 進度圖 ============
  sec.slide({ title: '研究進度', sub: '' }, (body) => {
    css(body);
    const N = [
      { d: '9 月', t: '文獻＋2D 模擬' }, { d: '10-01', t: '2D 對位' }, { d: '10-11', t: 'Z 軸模場' }, { d: '10-14', t: '三軸對位' },
      { d: '10-15', t: '場地加角度' }, { d: '10-15', t: '五軸＋切割角' }, { d: '10-23', t: '相機 ML 粗對位' }, { d: '10-29', t: 'PIC 性質研究', now: true },
    ];
    const nodes = N.map((n) => h('div', { class: `nd ${n.now ? 'now on' : ''}`, style: { cursor: 'default' } },
      h('div', { class: 'dt' }, n.d), h('div', { class: 'dot' }, n.now ? '●' : '✓'), h('div', { class: 'tt' }, n.t)));
    const li = (b, t) => h('li', null, h('b', null, b), t);
    const left = h('div', { class: 'card dark col', style: { gap: '10px', padding: '16px 24px', justifyContent: 'space-between' } },
      h('div', { class: 'pr-h', style: { color: '#7fb2ff' } }, '進度重點：光纖對光纖的模擬環境與單模五軸的光場建模已經完成'),
      h('ul', { class: 'pr-ul' },
        li('Z 軸模場：', '每層 Z 的 XY 光斑都是高斯，峰值 H 與寬度 s 只由 w₀、Z 決定'),
        li('三軸對位：', '粗動 → 相機 → 光訊號；用光斑寬度量間距，誤差 0.2 µm、約 6.5 s（模擬）'),
        li('場地加角度、五軸：', '六個自由度的耦合場；角度殘差 p95 0.084°（模擬）'),
        li('相機 ML 粗對位：', '上視＋側視影像估位置與傾角，達標率 94.3%（模擬影像）')),
      h('div', { class: 'pr-bridge' },
        h('span', null, '光纖對光纖'), h('i', null, '同一套模型與流程，只換參數 ➜'), h('span', { class: 'hot' }, 'PIC 邊緣耦合')),
      h('div', { class: 'pr-h', style: { color: '#ffb86b' } }, '今天要報告'),
      h('ol', { class: 'pr-ol' },
        h('li', null, h('b', null, '進度：'), '光纖對光纖的 Z 軸模場、對位演算法、角度對光斑的影響'),
        h('li', null, h('b', null, 'PIC 邊緣耦合：'), 'PIC 模場也是高斯、透鏡放在第幾層、容差縮小多少'),
        h('li', null, h('b', null, '光怎麼進晶片：'), '三種透鏡放法、透鏡光纖把聚焦點送進波導、端面反射'),
        h('li', null, h('b', null, '陣列光纖對 PIC：'), '先對第 1 通道、繞它轉 θz、看第 N 通道'),
        h('li', null, h('b', null, '對位平台：'), '3＋3＋6 機台、三段式對位、化身光纖、陣列實機對位')));
    const kpi = (v, l, s) => h('div', { class: 'card dark', style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' } },
      h('div', { style: { fontFamily: 'var(--mono)', fontSize: '44px', fontWeight: 800, color: '#ffb86b', textShadow: '0 0 18px rgba(255,138,61,.5)' } }, v),
      h('div', { style: { fontSize: '17px', fontWeight: 700, color: '#fff' } }, l), h('div', { class: 'small', style: { color: '#93a6c6' } }, s));
    body.append(h('style', null, `.pr-h { font-size:23px; font-weight:800; letter-spacing:.5px; }
      .pr-ul { margin:0; padding-left:24px; font-size:20px; line-height:1.6; color:#e8eefb; } .pr-ul b { color:#cfe0ff; }
      .pr-ol { margin:0; padding-left:28px; font-size:20px; line-height:1.65; color:#e8eefb; } .pr-ol b { color:#ffd29a; }
      .pr-bridge { display:flex; align-items:center; gap:14px; justify-content:center; padding:10px; border-radius:12px; background:linear-gradient(90deg, rgba(79,140,255,.18), rgba(255,138,61,.22)); border:1px solid rgba(255,184,107,.35); }
      .pr-bridge span { font-size:23px; font-weight:800; color:#cfe0ff; } .pr-bridge span.hot { color:#ffb86b; text-shadow:0 0 14px rgba(255,138,61,.6); }
      .pr-bridge i { font-style:normal; font-size:18px; color:#dfe8fa; }`),
      h('div', { class: 'tl', style: { flex: 'none' } }, nodes), h('div', { style: { height: '18px', flex: 'none' } }),
      h('div', { class: 'grid grow', style: { gridTemplateColumns: '1.7fr 1fr' } }, left,
        h('div', { class: 'grid', style: { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' } },
          kpi('0.2 µm', 'Z 軸間距誤差', '模擬｜光斑寬度法'), kpi('6.5 s', '三軸對位時間', '模擬｜理想平台平均'),
          kpi('0.084°', '五軸角度殘差 p95', '模擬｜混合法 12.3 s'), kpi('94.3%', '相機 ML 達標率', '模擬影像｜最終測試集'))));
  });

  // ============ 2. Z 軸模場建模 ============
  sec.slide({ title: 'Z 軸模場建模：換成 PIC 也只要改參數', sub: '' }, (body) => {
    css(body);
    const P = { f: { w: 5.2, WD: 0 }, l: { w: 1.5, WD: 30 } };   // 接收端固定為光纖（w = 5.2 µm）
    let src = 'f', Z = 40;
    const cv = h('canvas', { style: { width: '100%', height: '100%', display: 'block' } });
    const g = fitCanvas(cv, () => draw());
    const sZ = slider({ label: '間隙 Z', min: 0, max: 200, step: 1, value: Z, unit: 'µm', digits: 0, onInput: (v) => { Z = v; draw(); } });
    const STK = { f: ['assets/02_XYZ_stack.png', '切片法：平切光纖對光纖，Z = 0、20、50、100、150、200 µm 的 XY 切片疊起來（模擬｜進度報告 P3 第 58 張）'],
      l: ['assets/02_XYZ_stack_lensed.png', '切片法：透鏡光纖（w₀ 1.5 µm、光腰在端面外 30 µm）對光纖，Z = 0、30、60、100、150、200 µm（模擬｜MATLAB make_lensed_stack.m）']};
    const stkImg = h('img', { src: STK[src][0], alt: 'XYZ 堆疊切片' }), stkCap = h('div', { class: 'src' }, STK[src][1]);
    const sliceHost=h('div',{class:'slice-live',style:{flex:'1',minHeight:'0',width:'100%'}});
    stkImg.hidden=true;stkCap.hidden=true;
    const sliceMode=h('button',{type:'button',class:'btn ghost',onclick:()=>{
      const original=stkImg.hidden;stkImg.hidden=!original;stkCap.hidden=!original;sliceHost.hidden=original;
      sliceMode.textContent=original?'返回連動切片':'查看 MATLAB 原圖';
    }},'查看 MATLAB 原圖');
    // 公式欄跟著光源切換：平切＝兩端光腰相同的特例；透鏡光纖＝光腰不同的一般式（與 physics.js 的 eta 相同）
    const eqSame = [tex('\\eta(X,Y,Z)=\\frac{1}{A}\\exp\\!\\left[-\\frac{X^2+Y^2}{w_0^2\\,A}\\right],\\qquad A=1+\\left(\\frac{Z-Z_w}{2z_R}\\right)^{2}', 'sm'),
      tex('\\eta(X,Y)=H\\,e^{-\\frac{X^2+Y^2}{2s^2}},\\qquad H=\\frac{1}{A},\\quad s=\\frac{w_0}{\\sqrt{2}}\\sqrt{A},\\quad z_R=\\frac{\\pi n w_0^2}{\\lambda}', 'sm')];
    const eqDiff = [tex('\\eta(X,Y)=H\\,e^{-\\frac{X^2+Y^2}{2s^2}},\\qquad H=\\frac{4\\sigma}{(1+\\sigma)^2+\\left(\\frac{Z-Z_w}{z_R}\\right)^{2}}', 'sm'),
      tex('s^2=\\frac{(w_0^2+w_2^2)^2+\\left(\\lambda (Z-Z_w)/\\pi n\\right)^2}{4\\,(w_0^2+w_2^2)},\\qquad \\sigma=\\left(\\frac{w_2}{w_0}\\right)^{2}', 'sm')];
    const showEq = () => { eqSame.forEach((e) => { e.style.display = src === 'f' ? '' : 'none'; }); eqDiff.forEach((e) => { e.style.display = src === 'f' ? 'none' : ''; }); };
    showEq();
    const segS = segmented([{ id: 'f', label: '平切光纖' }, { id: 'l', label: '透鏡光纖' }], src, (id) => { src = id; stkImg.src = STK[id][0]; stkCap.textContent = STK[id][1]; showEq(); draw(); });
    function draw() {
      const { ctx, w: Wd, h: H } = g; if (!Wd) return;
      const { w: w1, WD } = P[src], p = { wf: w1, WD, wgx: 5.2, wgy: 5.2 };
      const E = (x, z) => eta(p, { dx: x, dy: 0, gap: z, tx: 0, ty: 0 });
      ctx.clearRect(0, 0, Wd, H);
      const font = (s, w = 400) => `${w} ${s}px system-ui, "Microsoft JhengHei", sans-serif`;
      // 左：XY 光斑熱圖（±20 µm），以整條 Z 的最大值正規化
      const sz = Math.min(H - 40, Wd * 0.45), x0 = 10, y0 = 28, N = 120, hw = 20;
      let e0 = 0; for (let z = 0; z <= 200; z++) e0 = Math.max(e0, E(0, z));
      const pk = E(0, Z), ex = []; for (let k = 0; k < N; k++) ex.push(Math.sqrt(E(-hw + (2 * hw * k) / (N - 1), Z) / Math.max(pk, 1e-12)));
      const img = ctx.createImageData(N, N);
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const [R, G, B] = heat((pk * ex[r] * ex[c]) / e0); img.data.set([R, G, B, 255], (r * N + c) * 4); }
      const oc = document.createElement('canvas'); oc.width = oc.height = N; oc.getContext('2d').putImageData(img, 0, 0);
      ctx.save(); ctx.beginPath(); ctx.roundRect(x0, y0, sz, sz, 12); ctx.clip(); ctx.drawImage(oc, x0, y0, sz, sz); ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = font(15, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(`XY 平面的耦合光斑 η(X,Y)，Z = ${Z} µm`, x0, y0 - 6);
      const sb = (10 / (2 * hw)) * sz; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 + 12, y0 + sz - 14); ctx.lineTo(x0 + 12 + sb, y0 + sz - 14); ctx.stroke(); ctx.fillText('10 µm', x0 + 12, y0 + sz - 18);
      // 右：H(Z) 與 s(Z)
      const px = x0 + sz + 56, pw = Wd - px - 14, ph1 = (H - 96) / 2, zs = []; for (let z = 0; z <= 200; z += 2) zs.push(z);
      const width = (z) => { const q = E(0, z); let lo = 0, hi = 80; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (E(m, z) > q * Math.exp(-0.5)) lo = m; else hi = m; } return lo; };
      const Hs = zs.map((z) => E(0, z)), Ss = zs.map(width);
      const plot = (yy, ys, ymax, col, lab, cur) => {
        ctx.strokeStyle = 'rgba(140,170,230,.25)'; ctx.lineWidth = 1; ctx.strokeRect(px, yy, pw, ph1);
        ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); zs.forEach((z, i) => { const X = px + (z / 200) * pw, Y = yy + ph1 - (ys[i] / ymax) * ph1; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke();
        const X = px + (Z / 200) * pw, Y = yy + ph1 - (cur / ymax) * ph1;
        ctx.save(); ctx.setLineDash([4,4]); ctx.strokeStyle='#b8d9ef'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(X,yy); ctx.lineTo(X,yy+ph1); ctx.stroke(); ctx.restore();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X, Y, 6, 0, 7); ctx.fill();
        ctx.fillStyle = col; ctx.font = font(15, 600); ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillText(lab, px + 8, yy + 6);
      };
      plot(y0, Hs, Math.max(...Hs) * 1.05, '#ffb86b', `峰值 H(Z) = ${(pk * 100).toFixed(1)}%`, pk);
      plot(y0 + ph1 + 34, Ss, Math.max(...Ss) * 1.1, '#4fc3ff', `寬度 s(Z) = ${width(Z).toFixed(2)} µm`, width(Z));
      ctx.fillStyle = '#93a6c6'; ctx.font = font(12); ctx.textBaseline = 'top'; ctx.textAlign = 'center';
      for (const z of [0, 50, 100, 150, 200]) ctx.fillText(`${z}`, px + (z / 200) * pw, y0 + 2 * ph1 + 38);
      ctx.fillText('Z（µm）', px + pw / 2, y0 + 2 * ph1 + 52);
      if (WD > 0) { const xw = px + (WD / 200) * pw; ctx.setLineDash([2, 3]); ctx.strokeStyle = '#ffd29a'; ctx.beginPath(); ctx.moveTo(xw, y0); ctx.lineTo(xw, y0 + 2 * ph1 + 34); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#ffd29a'; ctx.textAlign = 'left'; ctx.fillText(`光腰 Z = ${WD} µm`, xw + 6, y0 + ph1 - 20); }
      // 計畫版拿掉底部「最亮在 Z … σ = (w₂/w₀)² …」讀值（11-02 使用者要求）
      sliceView(sliceHost,[0,30,60,100,150,200].map(z=>({z,peak:E(0,z)/e0,width:width(z)})),{z:Z,peak:pk/e0,width:width(Z)});
    }
    const term = (sym, txt) => [h('b', { html: sym }), h('span', null, txt)];
    body.append(h('div', { class: 'grid grow', style: { gridTemplateColumns: '1fr 560px' } },
      h('div', { class: 'card dark col', style: { padding: '10px 12px' } }, h('div', { class: 'fill' }, cv), sZ.el,
        h('div', { class: 'row' }, h('span', { class: 'small', style: { color: '#93a6c6' } }, '光源'), segS.el)),
      h('div', { class: 'col', style: { gap: '10px' } },
        h('div', { class: 'card dark figc', style: { flex: '1.25' } }, sliceHost,stkImg,stkCap,sliceMode),
        h('div', { class: 'card dark', style: { padding: '6px 12px', flex: 'none' } }, ...eqSame, ...eqDiff),
        h('div', { class: 'card dark', style: { padding: '10px 14px', flex: 'none' } },
          h('div', { class: 'gl' },
            ...term('w<sub>0</sub>', '光腰半徑：平切光纖 5.2 µm；透鏡光纖約 1.5 µm（示意）'),
            ...term('Z<sub>w</sub>', '光腰離光纖端面的距離：平切 0；透鏡光纖約 30 µm'),
            ...term('z<sub>R</sub>', '瑞利長度（光腰附近光斑不太變大的範圍）；w₀ = 5.2 µm 時約 55 µm'),
            ...term('A', '擴束因子：離光腰越遠越大'),
            ...term('H', '每層 Z 的峰值耦合效率'),
            ...term('s', '每層 Z 的光斑寬度（功率高斯的標準差）'),
            ...term('λ, n', '波長 1.55 µm、間隙折射率 1'))))),
      h('div', { class: 'src', style: { flex: 'none', fontSize: '14px', color: '#c8d5ec' } }, PAPER));
    return { show() { g.apply(); draw(); } };
  });

  // ============ 3. Z 軸對位演算法 ============
  sec.slide({ title: 'Z 軸對位：從光學性質解間距，只能二選一', sub: '' }, (body) => {
    css(body);
    const card = (title, eq, items, win) => h('div', { class: 'card dark col mcard', style: win ? { borderColor:'#f1c58e', borderTopWidth:'3px' } : {} },
      h('h2', null, title), tex(eq), h('ul', null, items.map((t) => h('li', null, t))));
    const fig = (src, alt, st, ...top) => h('div', { class: 'card dark figc', style: st }, ...top, h('img', { src, alt }));
    const estHead = h('div', { style: { alignSelf: 'stretch', padding: '6px 10px 2px', color: '#d7e6f3' } },
      h('div', { style: { fontSize: '20px', fontWeight: 800 } }, '哪個方法量得準？'),
      h('div', { style: { fontSize: '16px', lineHeight: 1.55, marginTop: '4px' } },
        h('b', { style: { color: '#2b8a3e' } }, 'C（綠）'), '在起始間距 10–100 µm 誤差約 0.15–0.23 µm；',
        h('b', { style: { color: '#c0392b' } }, 'B（紅）'), '誤差上百到近千 µm，不能用。超過 100 µm 時 C 也開始變差，所以相機要先把間距送進 100 µm 內（XY 已對準、每點 300 次，模擬）。'));
    body.append(h('div', { class: 'grid grow', style: { gridTemplateColumns: '1fr 1fr 1.05fr', gridTemplateRows: 'auto 1fr auto' } },
      card('B　看峰值功率', 'H(Z)=\\dfrac{1}{A(Z)}', ['Z 方向前後抖動，用功率比反推 A', '要先知道 w₀：名義值差 3%，間距 25 µm 時就差約 3 µm（越遠越大）', '功率只有比值可用，還受 FP 漣漪影響']),
      card('C　看光斑寬度　✔ 採用', 's(Z)=\\dfrac{w_0}{\\sqrt{2}}\\sqrt{A(Z)}', ['繞圈量光斑寬度，單位是 µm 的絕對量', '兩個 Z 位置各量一次，同時解出 w₀ 與間距', '用圓上的二次諧波處理橢圓模場，精度 0.2–0.3 µm（模擬）'], true),
      fig('assets/presenter_p1_fig_est.png', '間距估計誤差', { gridRow: 'span 2' }, estHead),
      fig('assets/presenter_p1_fig_physics.png', '峰值與光斑寬度隨間距的變化', { gridColumn: 'span 2' }),
      h('div', { class: 'src', style: { gridColumn: '1 / -1', fontSize: '14px', color: '#c8d5ec' } },
        PAPER)));
  });

  // ============ 4. 三階段對位規劃＋連續軌跡動畫 ============
  sec.slide({ title: '三階段對位規劃', sub: '粗動 → 相機 → 光訊號；後面的 PIC 與機台都照這個架構' }, (body) => {
    css(body);
    const bg = ['linear-gradient(140deg,#2c5a93,#1d3c66)', 'linear-gradient(140deg,#5a3b9e,#3b2670)', 'linear-gradient(140deg,#b2450d,#7a2a06)'];
    const what = ['滑軌 XYZ 把光纖送到相機看得到的地方（還沒有光）', '上視＋側視相機（ML）：XY 進 ±40 µm、間距進 ±50 µm', '五步光訊號精對位（下方動畫）：最後間距約 0.2 µm、XY 約 0.02 µm（100 次中位數）'];
    const run = buildZRun();
    let t = 0, playing = false, speed = 1;
    const cv = h('canvas', { style: { width: '100%', height: '100%', display: 'block' } });
    const g = fitCanvas(cv, () => drawZ(g, run, t));
    const steps = h('div', { class: 'zsteps' }, ZSTEPS.map((s, i) => h('span', null, `${i + 1} ${s}`)));
    const btn = h('button', { class: 'btn', type: 'button', onclick: () => { if (t >= run.ev.total) t = 0; playing = !playing; btn.textContent = playing ? '⏸ 暫停' : '▶ 播放'; } }, '▶ 播放');
    const sp = segmented([{ id: '0.5', label: '0.5×' }, { id: '1', label: '1×' }, { id: '2', label: '2×' }], '1', (id) => { speed = +id; });
    const bar = h('input', { type: 'range', min: 0, max: Math.round(run.ev.total * 100), value: 0, style: { flex: '1' } });
    bar.addEventListener('input', () => { t = +bar.value / 100; playing = false; btn.textContent = '▶ 播放'; frame(); });
    const tl = h('span', { class: 'mono small', style: { color: '#dfe8fa', minWidth: '150px' } });
    function frame() {
      const s = drawZ(g, run, t); if (!s) return;
      [...steps.children].forEach((e, i) => { e.className = i === s.ph ? 'on' : ''; e.style.background = i === s.ph ? ZCOL[i] : ''; });
      bar.value = Math.round(t * 100); tl.textContent = `模擬時間 ${s.st.toFixed(2)} / ${run.ev.simTotal.toFixed(2)} s`;
    }
    let raf = 0, last = 0;
    const tick = (now) => { const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; if (playing) { t = Math.min(run.ev.total, t + dt * speed); if (t >= run.ev.total) { playing = false; btn.textContent = '↻ 重播'; } } frame(); raf = requestAnimationFrame(tick); };
    body.append(
      h('div', { class: 'st3', style: { flex: 'none' } }, STAGES.map((s, i) => h('div', { style: { background: bg[i] } }, h('b', null, s.name), h('span', null, what[i])))),
      h('div', { class: 'grid grow', style: { gridTemplateColumns: '1.62fr 1fr' } },
        h('div', { class: 'card dark col', style: { gap: '6px', padding: '8px 10px' } }, steps, h('div', { class: 'fill' }, cv),
          h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, btn, sp.el, bar, tl)),
        h('div', { class: 'col', style: { gap: '10px' } },
          h('div', { class: 'card dark', style: { flex: 'none', fontSize: '15px', lineHeight: 1.55, color: '#dfe8fa' } },
            h('b', { style: { color: '#ffb86b' } }, '範例（同進度報告）：'), `相機以為 80 µm，實際 ${run.ev.gTrue0.toFixed(1)} µm（超過 100 µm，屬較難的單次例子）；XY 起點偏 (${run.ev.start.x.toFixed(1)}, ${run.ev.start.y.toFixed(1)}) µm。完成：間距誤差 ${run.ev.gapErr >= 0 ? '+' : ''}${run.ev.gapErr.toFixed(2)} µm、核心偏差 ${(run.ev.xyRes * 1000).toFixed(0)} nm，全程 ${run.ev.simTotal.toFixed(1)} s（模擬）。`),
          h('div', { class: 'card dark figc', style: { flex: '1' } }, h('img', { src: 'assets/presenter_time_split.png', alt: '時間分配' }), h('div', { class: 'src' }, '靠近時每 4 步重對 XY：平均 6.5 s（模擬｜P2）')))));
    return { show() { g.apply(); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); }, hide() { cancelAnimationFrame(raf); playing = false; btn.textContent = '▶ 播放'; } };
  });

  // ============ 5. 六軸場地：角度讓 XY 平面的光斑變歪 ============
  sec.slide({ title: '六軸場地：有角度時，XY 平面的光斑會歪', sub: '' }, (body) => {
    css(body);
    // 接收端：透鏡光纖 → PIC（w 1.5 µm）；平切光纖 → 光纖（w 5.2 µm）
    const SRC = { l: { wsx: 1.5, wsy: 1.5, wd: 30, z: 50, hw: 40, zmax: 80, wr: 1.5 }, f: { wsx: 5.2, wsy: 5.2, wd: 0, z: 80, hw: 60, zmax: 120, wr: 5.2 } };
    const st = { x: 0, y: 0, z: 50, tx: 0, ty: 20 * DEG, tz: 0, wsx: 1.5, wsy: 1.5, wd: 30, wrx: 1.5, wry: 1.5 };
    let src = 'l';
    const HMc = h('canvas', { style: { width: '100%', height: '100%', display: 'block' } }), HM = fitCanvas(HMc, () => draw());
    const kTile = (lab, col) => { const v = h('b', { style: { display: 'block', fontFamily: 'var(--mono)', fontSize: '36px', fontWeight: 800, color: col, lineHeight: 1.1, whiteSpace: 'nowrap' } });
      return { v, el: h('div', { style: { flex: '1', textAlign: 'center', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(140,170,230,.22)', borderRadius: '12px', padding: '8px 6px' } }, v, h('span', { style: { fontSize: '15px', color: '#cfd9ec' } }, lab)) }; };
    const kLoss = kTile('耦合損失', '#ffb86b'), kEff = kTile('耦合效率', '#7fd3ff'), lossBig = kLoss.v, effBig = kEff.v;
    const live = h('div', { class: 'eqlive' });
    const hA = h('div', { class: 'c3d sch' });
    let sA = null, pend = false;
    const req = () => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; draw(); }); };
    const sY = slider({ label: 'θy 偏擺（往 X 傾）', min: -20, max: 20, step: 0.5, value: 20, unit: '°', digits: 1, onInput: (v) => { st.ty = v * DEG; req(); } });
    const sX = slider({ label: 'θx 俯仰（往 Y 傾）', min: -20, max: 20, step: 0.5, value: 0, unit: '°', digits: 1, onInput: (v) => { st.tx = v * DEG; req(); } });
    const sZ = slider({ label: '間距 Z（光纖尖端到端面）', min: 5, max: 80, step: 1, value: 50, unit: 'µm', digits: 0, onInput: (v) => { st.z = v; req(); } });
    const setZmax = () => { const i = sZ.el.querySelector('input'); i.max = SRC[src].zmax; };
    const seg = segmented([{ id: 'l', label: '透鏡光纖 → PIC' }, { id: 'f', label: '平切光纖 → 光纖' }], 'l', (id) => { src = id; const q = SRC[id]; Object.assign(st, { wsx: q.wsx, wsy: q.wsy, wd: q.wd, z: q.z, wrx: q.wr, wry: q.wr }); setZmax(); sZ.set(q.z, true); sA && sA.setReceiver(id === 'l' ? 'pic' : 'fiber'); draw(); });
    const N = 161;
    function draw() {
      if (sA) { try { sA.update(st); } catch (e) { console.error(e); } }
      if (!HM.w) return;
      const hw = SRC[src].hw, zr = (Math.PI * st.wsx * st.wsx) / LAMBDA, w = st.wsx * Math.sqrt(1 + ((st.z - st.wd) / zr) ** 2);
      const f = facet(st, hw, N);
      // 色階用 dB、以光腰處的峰值為 0 dB（facet 的 I 在光腰正中＝1），Z 拉遠時光斑變大變暗看得出來
      const FL = -30, dbc = (v) => (10 * Math.log10(Math.max(v, 1e-12)) - FL) / -FL;
      let m1 = 0, r0 = 0; f.I.forEach((v, k) => { if (v > m1) { m1 = v; r0 = k; } });
      const row = Math.floor(r0 / N), col = r0 % N, step = (2 * hw) / (N - 1);
      const { ctx, w: W, h: H } = HM; ctx.clearRect(0, 0, W, H);
      const L = 50, S = Math.min(W - L - 64, H - 74), T = Math.max(34, (H - S - 40) / 2 + 17);   // 計畫版：熱圖上下置中
      const img = ctx.createImageData(N, N);
      for (let k = 0; k < N * N; k++) { const [R, G, B] = jet(dbc(f.I[k])); img.data.set([R * 255, G * 255, B * 255, 255], k * 4); }
      const oc = document.createElement('canvas'); oc.width = oc.height = N; oc.getContext('2d').putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.drawImage(oc, L, T, S, S);
      const X = (x) => L + ((x + hw) / (2 * hw)) * S, Y = (y) => T + ((hw - y) / (2 * hw)) * S;
      const px0 = X(-hw + col * step), py0 = Y(hw - row * step);
      ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.beginPath(); ctx.moveTo(px0, T); ctx.lineTo(px0, T + S); ctx.stroke();
      ctx.strokeStyle = 'rgba(200,30,30,.85)'; ctx.beginPath(); ctx.moveTo(L, py0); ctx.lineTo(L + S, py0); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(X(0), Y(0), (w / (2 * hw)) * S, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#c8d5ec'; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (const v of [-hw, -hw / 2, 0, hw / 2, hw]) ctx.fillText(`${v}`, X(v), T + S + 4);
      ctx.fillText('X（µm）', L + S / 2, T + S + 20);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; for (const v of [-hw, 0, hw]) ctx.fillText(`${v}`, L - 6, Y(v));
      const cx0 = L + S + 14; for (let i = 0; i < S; i++) { const [R, G, B] = jet(1 - i / S); ctx.fillStyle = `rgb(${R * 255},${G * 255},${B * 255})`; ctx.fillRect(cx0, T + i, 14, 1.2); }
      ctx.fillStyle = '#c8d5ec'; ctx.textAlign = 'left'; ctx.fillText('0', cx0 + 18, T + 6); ctx.fillText('−15', cx0 + 18, T + S / 2); ctx.fillText(`${FL}`, cx0 + 18, T + S - 6);
      ctx.fillStyle = '#fff'; ctx.font = '600 15px system-ui, "Microsoft JhengHei", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('XY 平面光強度（dB，0＝光腰峰值）；白虛線＝沒有角度', L, T - 28);
      const e = f.eta, dB = (v) => -10 * Math.log10(Math.max(v, 1e-12));
      lossBig.textContent = dB(e) > 60 ? '> 60 dB' : `${dB(e).toFixed(2)} dB`;   // 太大時只說幾乎耦合不到
      effBig.textContent = e < 1e-4 ? '< 0.01%' : `${(100 * e).toFixed(2)}%`;
      // 左欄：把目前滑桿代入單軸閉式解（X 軸用 θy、Y 軸用 θx），和熱圖的重疊積分對照
      const ax = axisEta(st.wsx, st.wd, st.wrx, st.z, st.ty), ay = axisEta(st.wsx, st.wd, st.wrx, st.z, st.tx), fdb = (v) => (v > 60 ? '> 60' : v.toFixed(2));
      live.innerHTML = `d<sub>X</sub> = Z·tanθ<sub>y</sub> = ${ax.d.toFixed(1)} µm　d<sub>Y</sub> = ${ay.d.toFixed(1)} µm<br>` +
        `w₁ = ${ax.w1.toFixed(2)} µm　w₂ = ${st.wrx} µm　R = ${Math.abs(ax.R) > 1e4 ? '∞' : ax.R.toFixed(1) + ' µm'}<br>` +
        `η<sub>X</sub>：${fdb(dB(ax.eta))} dB　η<sub>Y</sub>：${fdb(dB(ay.eta))} dB<br>` +
        `<b>公式合計 ${fdb(dB(ax.eta * ay.eta))} dB</b>　｜　重疊積分（熱圖）${fdb(dB(e))} dB`;
    }
    const hd = (s) => h('div', { class: 'eqh' }, s);
    body.append(h('div', { class: 'grid grow', style: { gridTemplateColumns: '440px 1.05fr 1fr', gridTemplateRows: '1fr 1fr' } },
      h('div', { class: 'card dark col eqcol', style: { gap: '3px', gridRow: 'span 2' } },
        hd('① 耦合效率＝兩個光場的重疊積分；損失 L = −10 log₁₀ η'),
        tex('\\eta=\\frac{\\left|\\iint E_1E_2^{*}\\,dA\\right|^2}{\\iint|E_1|^2dA\\,\\iint|E_2|^2dA}', 'xs'),
        hd('② 光纖繞尖端轉 θ：光到端面時中心偏 d、光斑變成 w₁、波前曲率半徑 R（u = Z − z_w，z_w＝光腰離尖端）'),
        tex('d=Z\\tan\\theta,\\quad w_1=w_0\\sqrt{1+\\tfrac{u^2}{z_R^2}},\\quad \\tfrac{1}{R}=\\tfrac{u}{u^2+z_R^2},\\quad z_R=\\tfrac{\\pi w_0^2}{\\lambda}', 'xs'),
        hd('③ X、Y 各算一次再相乘 η = η_X η_Y（k = 2π/λ，w₂＝接收端模場）'),
        tex('\\eta_X=\\frac{2}{w_1w_2|\\alpha|}\\exp\\!\\left[2\\,\\mathrm{Re}\\frac{\\beta^2}{4\\alpha}-\\frac{2d^2}{w_1^2}\\right]', 'xs'),
        tex('\\alpha=\\tfrac{1}{w_1^2}+\\tfrac{1}{w_2^2}+\\tfrac{ik}{2R},\\qquad \\beta=\\tfrac{2d}{w_1^2}+ik\\left(\\tfrac{d}{R}-\\theta\\right)', 'xs'),
        hd('④ 特例：兩光腰重合（d = 0、R → ∞）'),
        tex('\\eta_\\theta=\\kappa\\,\\exp\\!\\left[-\\frac{2\\pi^2\\theta^2}{\\lambda^2}\\,\\frac{w_1^2w_2^2}{w_1^2+w_2^2}\\right],\\quad \\kappa=\\left(\\frac{2w_1w_2}{w_1^2+w_2^2}\\right)^{2}', 'xs'),
        hd('⑤ 代入目前的滑桿'), live,
        seg.el, sY.el, sX.el, sZ.el),
      h('div', { class: 'col', style: { gridRow: 'span 2' } },
        h('div', { class: 'card dark fill', style: { padding: '6px 8px', position: 'relative' } }, (HMc.style.position = 'absolute', HMc.style.inset = '0', HMc)),
        h('div', { class: 'row', style: { flex: 'none', flexWrap: 'nowrap', gap: '10px' } }, kLoss.el, kEff.el)),
      h('div', { class: 'card dark col', style: { padding: '6px', minHeight: '0', gridRow: 'span 2', gap: '6px' } },
        h('div', { style: { position: 'relative', flex: '1', minHeight: '0' } }, hA),
        h('div', { style: { flex: 'none', fontSize: '15px', color: '#dfe8fa', textAlign: 'center', padding: '2px 6px 4px' } }, '3D 示意：光纖繞尖端轉 θ，光打到接收端端面的位置（白虛線＝沒有角度）'))));
    hA.style.position = 'absolute'; hA.style.inset = '0';
    sA = new Schem3D(hA, 'shift');   // 建頁時就建（配合封面預載），第一次顯示不卡
    sA.setReceiver(src === 'l' ? 'pic' : 'fiber');
    return {
      show() { if (!sA) { sA = new Schem3D(hA, 'shift'); sA.setReceiver(src === 'l' ? 'pic' : 'fiber'); } HM.apply(); draw(); sA.start(); },
      hide() { sA && sA.stop(); },
    };
  });

  // ============ 6. 六軸偏差：XY 平面的光斑與耦合功率 ============
  sec.slide({ title: '六軸偏差：光斑在 XY 平面的樣子與耦合功率', sub: '' }, (body) => {
    css(body);
    const SRC = { l: { wsx: 1.5, wsy: 1.5, wd: 30, z: 30, hw: 15 }, f: { wsx: 5.2, wsy: 5.2, wd: 0, z: 5, hw: 15 } };   // 熱圖視窗 30 × 30 µm
    const st = { x: 0, y: 0, z: 30, tx: 0, ty: 0, tz: 0, wsx: 1.5, wsy: 1.5, wd: 30, wrx: 1.5, wry: 1.5 };
    let src = 'l', ell = false, pend = false;
    const cv = h('canvas', { style: { width: '100%', height: '100%', display: 'block' } }), G = fitCanvas(cv, () => req());
    const bars = h('canvas', { style: { width: '100%', height: '100%', display: 'block' } }), B = fitCanvas(bars, () => req());
    const big = h('div', { class: 'big', style: { color: '#ffb86b', fontSize: '44px', textShadow: '0 0 18px rgba(255,138,61,.45)' } });
    const sub = h('div', { style: { color: '#93a6c6', fontSize: '15px' } });
    const hA = h('div', { class: 'c3d sch' }); let sA = null;
    const meter = h('i', { style: { display: 'block', height: '100%', width: '0', background: 'linear-gradient(90deg,#c92a2a,#f0a030,#2f9e44)', borderRadius: '7px' } });
    const req = () => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; draw(); }); };
    const sl = (k, label, min, max, step, unit, scale = 1) => slider({ label, min, max, step, value: st[k] / scale, unit, digits: unit === '°' ? 2 : 1, onInput: (v) => { st[k] = v * scale; req(); } });
    const S = [sl('x', 'X 橫向', -4, 4, 0.05, 'µm'), sl('y', 'Y 垂直', -4, 4, 0.05, 'µm'), sl('z', 'Z 間距', 5, 80, 0.5, 'µm'),
      sl('tx', 'θx 俯仰', -5, 5, 0.05, '°', DEG), sl('ty', 'θy 偏擺', -5, 5, 0.05, '°', DEG), sl('tz', 'θz 滾轉', -90, 90, 1, '°', DEG)];
    const setSrc = () => { const q = SRC[src]; Object.assign(st, { wsx: q.wsx, wd: q.wd }); st.wsy = ell ? q.wsx * 0.5 : q.wsx; st.wry = ell ? st.wrx * 0.5 : st.wrx; req(); };
    const segS = segmented([{ id: 'l', label: '透鏡光纖 → PIC' }, { id: 'f', label: '光纖 → 光纖' }], 'l', (id) => { src = id; st.wrx = id === 'l' ? 1.5 : 5.2; st.z = SRC[id].z; S[2].set(st.z, true); setSrc(); });
    const segE = segmented([{ id: 'c', label: '圓形模場' }, { id: 'e', label: '橢圓模場（看得出 θz）' }], 'c', (id) => { ell = id === 'e'; setSrc(); });
    const reset = () => { Object.assign(st, { x: 0, y: 0, tx: 0, ty: 0, tz: 0, z: SRC[src].z }); S.forEach((s, i) => s.set([0, 0, st.z, 0, 0, 0][i], true)); req(); };
    const N = 141, NAMES = ['X', 'Y', 'Z', 'θx', 'θy', 'θz'], KEYS = ['x', 'y', 'z', 'tx', 'ty', 'tz'];
    function draw() {
      if (sA) { try { sA.update(st); } catch (e) { console.error(e); } }
      const q = SRC[src], hw = q.hw;
      const ideal = { ...st, x: 0, y: 0, z: q.wd > 0 ? q.wd : 5, tx: 0, ty: 0, tz: 0 };   // 理想位置：透鏡光纖在光腰，平切光纖貼近 5 µm
      const f = facet(st, hw, N), f0 = facet(ideal, hw, N);
      let mx = 0; for (const v of f0.I) mx = Math.max(mx, v);
      const e = f.eta, e0 = f0.eta;
      big.textContent = `${(e * 100).toFixed(1)}%`;
      sub.textContent = `損耗 ${(-10 * Math.log10(Math.max(e, 1e-9))).toFixed(2)} dB　（對準時 ${(e0 * 100).toFixed(1)}%）`;
      meter.style.width = `${Math.max(1, Math.min(100, (e / e0) * 100))}%`;
      // 熱圖：以「對準時的峰值」為 1，偏差後變暗也看得出來
      if (G.w) {
        const { ctx, w: W, h: H } = G; ctx.clearRect(0, 0, W, H);
        const L = 50, T = 34, Sz = Math.min(W - L - 64, H - T - 40);
        const img = ctx.createImageData(N, N);
        for (let k = 0; k < N * N; k++) { const [R, Gc, Bc] = jet(f.I[k] / mx); img.data.set([R * 255, Gc * 255, Bc * 255, 255], k * 4); }
        const oc = document.createElement('canvas'); oc.width = oc.height = N; oc.getContext('2d').putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = true; ctx.drawImage(oc, L, T, Sz, Sz);
        const X = (x) => L + ((x + hw) / (2 * hw)) * Sz, Y = (y) => T + ((hw - y) / (2 * hw)) * Sz;
        // 接收端模場（1/e²，可轉）
        ctx.save(); ctx.translate(X(0), Y(0)); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.ellipse(0, 0, (st.wrx / (2 * hw)) * Sz, (st.wry / (2 * hw)) * Sz, 0, 0, 7); ctx.stroke(); ctx.restore(); ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(0), T); ctx.lineTo(X(0), T + Sz); ctx.moveTo(L, Y(0)); ctx.lineTo(L + Sz, Y(0)); ctx.stroke();
        ctx.fillStyle = '#c8d5ec'; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        for (const v of [-hw, -hw / 2, 0, hw / 2, hw]) ctx.fillText(`${v}`, X(v), T + Sz + 4);
        ctx.fillText('X（µm）', L + Sz / 2, T + Sz + 20);
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; for (const v of [-hw, 0, hw]) ctx.fillText(`${v}`, L - 6, Y(v));
        const cx0 = L + Sz + 14; for (let i = 0; i < Sz; i++) { const [R, Gc, Bc] = jet(1 - i / Sz); ctx.fillStyle = `rgb(${R * 255},${Gc * 255},${Bc * 255})`; ctx.fillRect(cx0, T + i, 14, 1.2); }
        ctx.fillStyle = '#c8d5ec'; ctx.textAlign = 'left'; ctx.fillText('1', cx0 + 18, T + 6); ctx.fillText('0', cx0 + 18, T + Sz - 6);
        ctx.fillStyle = '#fff'; ctx.font = '600 15px system-ui, "Microsoft JhengHei", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('接收端面上的光強度（1＝對準時的峰值）；白虛線＝接收端模場', L, 6);
      }
      // 各軸單獨造成的損耗
      if (B.w) {
        const { ctx, w: W, h: H } = B; ctx.clearRect(0, 0, W, H);
        const loss = KEYS.map((k) => { const one = { ...ideal, [k]: st[k] }; if (k === 'z') one.z = st.z; const v = facet(one, hw, 81).eta; return Math.max(0, -10 * Math.log10(Math.max(v, 1e-9) / Math.max(f0.eta, 1e-9))); });
        const mxL = Math.max(1, ...loss), rowH = Math.min(48, (H-42)/6);
        ctx.fillStyle='#dce9f5';ctx.font='600 15px system-ui';ctx.textAlign='left';ctx.fillText('各軸單獨造成的損耗（dB）',4,20);
        loss.forEach((v,i)=>{
          const y=42+i*rowH, left=40, width=W-110;
          if(body.closest('.slide').dataset.activeAxis===String(i)){ctx.fillStyle='#395570';ctx.fillRect(0,y-6,W,rowH-2);ctx.strokeStyle='#f1c58e';ctx.lineWidth=2;ctx.strokeRect(1,y-6,W-2,rowH-2);}
          ctx.fillStyle='#acc4db';ctx.font='15px system-ui';ctx.textAlign='left';ctx.fillText(NAMES[i],4,y+15);
          ctx.fillStyle='#263e56';ctx.fillRect(left,y,width,18);
          ctx.fillStyle=v<.5?'#88cbbd':v<3?'#f1c58e':'#ed8c79';ctx.fillRect(left,y,width*v/mxL,18);
          ctx.fillStyle='#e5f0fa';ctx.textAlign='right';ctx.fillText(v.toFixed(2),W-5,y+15);
        });
      }
    }
    body.append(h('div', { class: 'grid grow', style: { gridTemplateColumns: '380px 1.05fr 0.95fr' } },
      h('div', { class: 'card dark col', style: { gap: '6px' } },
        h('div', { class: 'six' }, S.map((s) => s.el)), segS.el, segE.el,
        h('div', { class: 'row' }, h('button', { class: 'btn ghost', type: 'button', onclick: reset }, '全部歸零')),
        h('div', { class: 'fill', style: { minHeight: '150px' } }, bars)),   // 計畫版拿掉「進入 ② PIC 邊緣耦合」按鈕（改由架構圖分章）
      h('div', { class: 'card dark col', style: { padding: '6px 8px', gap: '4px' } }, h('div', { class: 'fill' }, cv),
        h('div', { class: 'col', style: { flex: 'none', alignItems: 'center', textAlign: 'center', gap: '2px', padding: '6px 0 8px', borderTop: '1px solid rgba(140,170,230,.2)' } },
          h('div', { style: { color: '#93a6c6', fontSize: '15px' } }, '實際耦合功率（數值重疊積分）'), big, sub,
          h('div', { style: { width: '90%', height: '14px', borderRadius: '7px', background: 'rgba(255,255,255,.08)', overflow: 'hidden' } }, meter))),
      h('div', { class: 'card dark', style: { padding: '6px', position: 'relative', minHeight: '0' } }, hA)));
    hA.append(h('div', { class: 'ttl' }, '光軸繞尖端轉 θ，光斑中心移 Z·tanθ'));
    sA = new Schem3D(hA, 'shift');   // 建頁時就建（配合封面預載），第一次顯示不卡
    return {
      show() { if (!sA) sA = new Schem3D(hA, 'shift'); G.apply(); B.apply(); draw(); sA.start(); },
      hide() { sA && sA.stop(); },
    };
  });
}
