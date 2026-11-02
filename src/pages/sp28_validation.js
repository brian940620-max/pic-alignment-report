// Presentation view only; the existing UHNA array model is supplied by fa_pic.js.
import { h, slider, segmented, fitCanvas, DEG, clamp } from '../ui.js';

const CSS = `
.slide.validation-ui .array-view-6 > .validation-grid { grid-template-columns:minmax(0,1fr) 420px!important; gap:18px!important; }
.slide.validation-ui .validation-plot,.slide.validation-ui .validation-controls { padding:24px; display:flex; flex-direction:column; gap:18px; }
.validation-ui .validation-plot { background:radial-gradient(ellipse at 50% 0,#8bcdd50b,transparent 70%),#102133; box-shadow:inset 0 1px #d8eef70b,0 12px 30px #00000014; }
.validation-ui .validation-heading { display:flex; align-items:center; justify-content:space-between; gap:20px; padding-bottom:16px; border-bottom:1px solid #8caec31c; }
.validation-ui .validation-heading h2 { margin:0; color:#edf4f8; font-size:24px; font-weight:600; }
.validation-ui .validation-legend { display:flex; gap:16px; font-size:13px; color:#acc5d5; padding:8px 12px; border:1px solid #8caec321; border-radius:20px; background:#091a293d; }
.validation-ui .validation-legend span::before { content:''; display:inline-block; width:7px; height:7px; margin-right:5px; border-radius:50%; background:var(--dot); }
.validation-ui .validation-canvas { position:relative; flex:1; min-height:0; }
.validation-ui .validation-canvas canvas { position:absolute; inset:0; width:100%; height:100%; display:block; }
.validation-ui .validation-reading { padding:22px; border:1px solid #83c7b44a; border-radius:14px; background:radial-gradient(ellipse at 100% 0,#8bd6be1c,transparent 75%),#0f2334; box-shadow:inset 3px 0 #94d6cb; transition:border-color .2s,box-shadow .2s; }
.validation-ui .validation-reading[data-pass=false] { border-color:#df9c786b; background:linear-gradient(120deg,#e0a07812,#0f2334); }
.validation-ui .validation-reading[data-pass=false] { box-shadow:inset 3px 0 #e5a087; }
.validation-ui .validation-reading > span { color:#a4bece; font-size:13px; letter-spacing:1px; }
.validation-ui .validation-verdict { margin:9px 0; color:#a9e4cb; font-size:37px; font-weight:650; line-height:1.2; }
.validation-ui .validation-reading[data-pass=false] .validation-verdict { color:#efb898; }
.validation-ui .validation-rule { color:#bbcfdb; font-size:14px; }
.validation-ui .validation-rule b { color:#efcfa2; font-size:17px; }
.validation-ui .validation-ends { display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:0 0 4px; }
.validation-ui .validation-end { padding:15px 13px; border:1px solid #d9b88435; border-top:2px solid #d9b88499; border-radius:10px; background:linear-gradient(145deg,#d9b88409,#091a2938); }
.validation-ui .validation-end span { display:block; color:#a8c1d2; font-size:13px; margin-bottom:6px; }
.validation-ui .validation-end strong { color:#dbeef2; font:600 30px var(--mono); letter-spacing:-1px; font-variant-numeric:tabular-nums; }
.validation-ui .validation-end small { color:#a6becf; font-size:13px; margin-left:6px; }
.validation-ui .validation-end[data-pass=false] strong { color:#edab92; }
.validation-ui .validation-option { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.validation-ui .validation-option > span { color:#a8c1d2; font-size:14px; }
.validation-ui .validation-option .seg { flex-wrap:nowrap; }
.slide.validation-ui .validation-option .seg button { padding:9px 14px; white-space:nowrap; flex:none; }
.validation-ui .validation-adjust { margin-top:auto; padding-top:22px; border-top:1px solid #8cabc529; }
.validation-ui .validation-adjust .slider { margin:0 0 14px; }
.validation-ui .validation-presets { display:flex; gap:10px; }
.validation-ui .validation-presets .btn { flex:1; padding:10px 14px; }
.slide.validation-ui .validation-presets .btn:first-child { border-color:#8bcbd260; background:linear-gradient(130deg,#26495b,#1d3547); color:#d5f0f0; }
.validation-ui button:focus-visible,.validation-ui summary:focus-visible,.validation-ui input:focus-visible { outline:2px solid #a3dce2; outline-offset:4px; }
.validation-ui .validation-adjust p { color:#96b1c3; font-size:13px; margin:10px 0 0; }
.validation-ui .validation-takeaway { display:flex; align-items:center; gap:18px; padding:17px 23px; border:1px solid #bfa27850; border-radius:12px; background:linear-gradient(100deg,#d8b78013,#122638); }
.validation-ui .validation-takeaway b { color:#f0d0a6; font-size:19px; font-weight:600; }
.validation-ui .validation-takeaway span { color:#c1d4df; font-size:17px; }
.validation-ui .validation-takeaway i { font-style:normal; color:#b3c6ce; }
.validation-ui .validation-takeaway details { position:relative; padding:0; margin:0 0 0 auto; background:transparent; border:0; flex:none; }
.validation-ui .validation-takeaway summary { color:#b5cbd8; cursor:pointer; font-size:13px; padding:6px 0 6px 12px; }
.validation-ui .validation-details { position:absolute; right:0; bottom:calc(100% + 18px); z-index:10; width:660px; padding:22px 26px; border:1px solid #69879e; border-radius:14px; background:#112639; box-shadow:0 12px 40px #0007; color:#bed0dc; font-size:14px; line-height:1.65; }
.validation-ui .validation-details p { margin:8px 0; }
.validation-ui .validation-details a { color:#b9dfe7; }
.validation-ui .validation-details strong { color:#ecd0a8; }
@media (prefers-reduced-motion:reduce) { .validation-ui .validation-reading { transition:none; } }
`;

export function buildValidation(body, { S, chans, PEAK, tol1dB }) {
  body.closest('.slide').classList.add('validation-ui');
  const state = { angle:.03 };
  const cv = h('canvas', { role:'img', 'aria-label':'多通道模擬：兩端對位與各通道額外損耗' });
  const G = fitCanvas(cv, () => draw());
  const verdict = h('div', { class:'validation-verdict', role:'status' });
  const result = h('div', { class:'validation-reading' }, h('span', null, '兩端判定'), verdict,
    h('div', { class:'validation-rule' }, '額外損耗皆 ', h('b', null, '≤ 1 dB')));
  const endView = label => {
    const name = h('span', null, label), value = h('strong');
    return { name, value, el:h('div', { class:'validation-end' }, name, value, h('small', null, 'dB')) };
  };
  const first = endView('CH 1'), last = endView('CH ' + S.N);
  const sN = segmented([4,8,16].map(n => ({ id:String(n), label:String(n) })), String(S.N), id => { S.N = +id; draw(); });
  const sP = segmented([127,250].map(n => ({ id:String(n), label:n + ' µm' })), String(S.P), id => { S.P = +id; draw(); });
  const sT = slider({ label:'滾轉 θz', min:-.15, max:.15, step:.001, value:state.angle, unit:'°', digits:3, onInput:value => { state.angle = value; draw(); } });
  const setAngle = value => { sT.set(value, true); state.angle = sT.get(); draw(); };
  const fmt = (size, weight=400) => weight + ' ' + size + 'px system-ui, "Microsoft JhengHei", sans-serif';
  // Display loss relative to the aligned state. This is the same 1 dB decision
  // used by the former absolute-efficiency plot, without the baseline offset.
  const loss = efficiency => Math.max(0, -10 * Math.log10(Math.max(efficiency / PEAK, 1e-12)));

  function draw() {
    const C = chans({ thz:state.angle * DEG }), losses = C.map(c => loss(c.e));
    const pass = losses[0] <= 1 && losses.at(-1) <= 1;
    result.dataset.pass = String(pass); verdict.textContent = pass ? '兩端達標' : '仍需對位';
    last.name.textContent = 'CH ' + S.N;
    [first,last].forEach((view, j) => { const l = losses[j ? S.N - 1 : 0]; view.value.textContent = l.toFixed(2); view.el.dataset.pass = String(l <= 1); });
    cv.setAttribute('aria-label', '各通道額外損耗 dB：' + losses.map(x => x.toFixed(2)).join('、') + '；' + verdict.textContent);
    if (!G.w) return;
    const { ctx, w:W, h:H } = G;
    ctx.clearRect(0, 0, W, H);
    const L = 45, R = W - 15, bw = (R - L) / S.N, X = i => L + (i + .5) * bw;
    const rowH = Math.min(235, H * .44), cy = rowH * .48;
    const mag = Math.min(10, rowH * .23 / Math.max(.001, ...C.map(c => Math.abs(c.oy))));
    const radius = Math.min(14, bw * .22), edge = i => i === 0 || i === S.N - 1;
    const facet = ctx.createLinearGradient(0,28,0,rowH-40);
    facet.addColorStop(0,'#07152155'); facet.addColorStop(1,'#193a4a30');
    ctx.fillStyle = facet; ctx.beginPath(); ctx.roundRect(L,30,R-L,rowH-72,14); ctx.fill();
    [0,S.N-1].forEach(i => {
      const laneWidth = Math.min(96,bw*.86), x = X(i)-laneWidth/2;
      ctx.fillStyle = '#e7bf860b'; ctx.beginPath(); ctx.roundRect(x, 30, laneWidth, H - 38, 10); ctx.fill();
      ctx.strokeStyle = '#e7bf8630'; ctx.lineWidth = 1; ctx.stroke();
    });
    ctx.strokeStyle = '#88c8d52e'; ctx.lineWidth = 1; ctx.setLineDash([3,5]); ctx.beginPath(); ctx.moveTo(X(0), cy); ctx.lineTo(X(S.N-1), cy); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#e9bc8059'; ctx.beginPath(); C.forEach((c,i) => { const x = X(i) + c.ox * mag, y = cy - c.oy * mag; i ? ctx.lineTo(x,y) : ctx.moveTo(x,y); }); ctx.stroke();
    C.forEach((c,i) => {
      const x = X(i), fx = x + c.ox * mag, fy = cy - c.oy * mag;
      ctx.fillStyle = '#82c9df15'; ctx.strokeStyle = '#8bd7e0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x,cy,radius,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#8bd7e049'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x-4,cy); ctx.lineTo(x+4,cy); ctx.moveTo(x,cy-4); ctx.lineTo(x,cy+4); ctx.stroke();
      const glow = ctx.createRadialGradient(fx,fy,0,fx,fy,radius * 1.5); glow.addColorStop(0,'#f4d7a6a0'); glow.addColorStop(.5,'#edbc7048'); glow.addColorStop(1,'#edbc7000');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(fx,fy,radius*1.5,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#eec58b'; ctx.lineWidth = edge(i) ? 2 : 1; ctx.beginPath(); ctx.arc(fx,fy,radius,0,Math.PI*2); ctx.stroke();
      const core = ctx.createRadialGradient(fx-radius*.25,fy-radius*.25,0,fx,fy,radius*.68);
      core.addColorStop(0,'#fff1d7bd'); core.addColorStop(.35,'#f0cb8860'); core.addColorStop(1,'#e9bc8000');
      ctx.fillStyle = core; ctx.beginPath(); ctx.arc(fx,fy,radius*.68,0,Math.PI*2); ctx.fill();
      ctx.font = fmt(13,edge(i)?650:400); ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = edge(i) ? '#f1cfa2' : '#91aebf'; ctx.fillText('CH '+(i+1),x,rowH-28);
    });
    ctx.font = fmt(12); ctx.fillStyle = '#90aabd'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('端面偏移 ×' + mag.toFixed(1) + ' 示意',L,8);
    // Reserve a separate heading row and label band, including capped bars.
    const top = rowH + 70, bottom = H - 30, range = 6, Y = l => bottom - clamp(l / range,0,1) * (bottom-top);
    ctx.font = fmt(15,600); ctx.fillStyle = '#c6dae5'; ctx.fillText('各通道額外損耗',L,rowH+12);
    ctx.font = fmt(13); ctx.fillStyle = '#91aebf'; ctx.textAlign = 'right'; ctx.fillText('越低越好',R,rowH+13);
    ctx.fillStyle = '#89d5ba0c'; ctx.fillRect(L,Y(1),R-L,bottom-Y(1));
    ctx.lineWidth = 1;
    [0,1,3,6].forEach(l => {
      ctx.strokeStyle = l === 1 ? '#d9b884b0' : '#8aadc222'; ctx.setLineDash(l === 1 ? [5,5] : []); ctx.beginPath(); ctx.moveTo(L,Y(l)); ctx.lineTo(R,Y(l)); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = fmt(12); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = l === 1 ? '#edc891' : '#91aebf'; ctx.fillText(l+' dB',L-8,Y(l));
    });
    losses.forEach((l,i) => {
      const x = X(i), width = Math.min(42,bw*.54), y = Y(l), color = l <= 1 ? '#94d6cb' : '#e5a087';
      const gradient = ctx.createLinearGradient(0,top,0,bottom); gradient.addColorStop(0,color); gradient.addColorStop(1,l<=1?'#438d94':'#996a5c');
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.roundRect(x-width/2,y,width,Math.max(2,bottom-y),3); ctx.fill();
      ctx.fillStyle = l<=1?'#d3f5e9ad':'#ffe0c5ad'; ctx.fillRect(x-width/2+2,y,Math.max(1,width-4),2);
      ctx.font = fmt(S.N>8?12:14,600); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      const label = l>range?'>6':l.toFixed(2), labelWidth = ctx.measureText(label).width + 10;
      ctx.fillStyle = '#102133'; ctx.fillRect(x-labelWidth/2,y-25,labelWidth,20);
      ctx.fillStyle = color; ctx.fillText(label,x,y-7);
      ctx.font = fmt(12); ctx.fillStyle = edge(i)?'#eac99e':'#91aebf'; ctx.textBaseline = 'top'; ctx.fillText(String(i+1),x,bottom+10);
    });
  }

  const details = h('details', null, h('summary', null, '模型與依據'), h('div', { class:'validation-details' },
    h('strong', null, '判定範圍'),
    h('p', null, '第 1 通道保持對準，以它為中心滾轉。理想剛性陣列中，離中心越遠，偏移越大；兩端達標可作為對位指標。實際纖芯位置有誤差，仍需逐一驗證中間通道。'),
    h('p', null, '此頁使用 UHNA 高斯重疊示意模型：光纖模場半徑 1.75 µm、SSC 半徑 1.5 µm。額外損耗相對標稱對準值；1 dB 是本報告自訂門檻，尚未真機驗證。'),
    h('p', null, '幾何關係：Δyₙ = (N−1)P sin θz。'),
    h('p', null, '模型與陣列偏差：',h('a',{href:'https://doi.org/10.1364/PRJ.7.000201',target:'_blank',rel:'noopener noreferrer'},'Marchetti et al.（2019）'),'；模場參數：',h('a',{href:'https://doi.org/10.3390/app6120426',target:'_blank',rel:'noopener noreferrer'},'Carroll et al.（2016）'),'；多通道對位：',h('a',{href:'https://doi.org/10.37188/lam.2023.003',target:'_blank',rel:'noopener noreferrer'},'Xu et al.（2023）'), '。')));
  body.append(h('style',null,CSS),
    h('div',{class:'grid grow validation-grid'},
      h('section',{class:'card dark validation-plot'},
        h('div',{class:'validation-heading'},h('h2',null,'先看兩端，再驗全通道'),h('div',{class:'validation-legend'},h('span',{style:{'--dot':'#8bd7e0'}},'PIC'),h('span',{style:{'--dot':'#eec58b'}},'光纖'))),
        h('div',{class:'validation-canvas'},cv)),
      h('section',{class:'card dark validation-controls'},result,h('div',{class:'validation-ends'},first.el,last.el),
        h('div',{class:'validation-option'},h('span',null,'通道數'),sN.el),
        h('div',{class:'validation-option'},h('span',null,'通道間距'),sP.el),
        h('div',{class:'validation-adjust'},sT.el,h('div',{class:'validation-presets'},
          h('button',{class:'btn',type:'button',onclick:()=>setAngle(0)},'對準'),
          h('button',{class:'btn ghost',type:'button',onclick:()=>setAngle(Math.min(.15,tol1dB().thz/DEG*1.6))},'顯示失配')),
          h('p',null,'以第 1 通道為旋轉中心')))),
    h('div',{class:'validation-takeaway'},h('b',null,'兩端達標'),h('i',{'aria-hidden':'true'},'→'),h('span',null,'實機仍須逐通道確認'),details));
  draw();
  return { show() { sN.set(String(S.N),true); sP.set(String(S.P),true); G.apply(); draw(); }, hide() { details.open=false; } };
}
