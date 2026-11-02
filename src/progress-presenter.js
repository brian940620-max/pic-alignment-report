import { h } from './ui.js';

// Presentation-only controls. Existing sliders remain the sole state owners.
export function enhanceProgress(body) {
  queueMicrotask(() => {
    const slide = body.closest('.slide');
    // 計畫版把頁拆到各章，改用標題判斷原版第幾頁（2 研究進度、5 三階段、6 六軸場地、7 六軸偏差），頁序變了也不會錯位
    const title = slide.querySelector('.stitle h1')?.textContent || '';
    const page = [['研究進度', 2], ['三階段對位', 5], ['六軸場地', 6], ['六軸偏差', 7]].find(([k]) => title.startsWith(k))?.[1] || 0;
    slide.dataset.progressPage = page;
    const resize = () => requestAnimationFrame(() => window.dispatchEvent(new Event('deckscale')));
    const toolbar = h('div', { class:'presenter-tools' });
    const mode = (label, cls) => {
      const button = h('button', {type:'button',class:'btn ghost','aria-pressed':'false',onclick:()=>{
        const enabled=slide.classList.toggle(cls);button.setAttribute('aria-pressed',String(enabled));resize();
      }},label);toolbar.append(button);return button;
    };
    if (page===5) {
      mode('放大演示', 'demo-focus');
      body.prepend(toolbar);
    }
    if (page===6) {
      const col=body.querySelector('.eqcol');
      const parts=[...col.children];
      const derivation=h('div',{class:'derivation'});
      // Preserve all original equations, including live substitution.
      const end=parts.findIndex(e=>e.classList.contains('eqlive'));
      parts.slice(0,end-1).forEach(e=>derivation.append(e));
      col.prepend(derivation);
      const intro=h('div',{class:'talk-summary'},h('h2',null,'角度、距離與耦合'),
        h('div',{class:'talk-equation'},'Δx = Z · tan θ'),
        h('p',null,'調整角度與間距，同時觀察光點位置、幾何關係與耦合損失。'));
      col.prepend(intro);
      if (slide.classList.contains('pose-field-ui')) {
        const controls=h('div',{class:'pose-controls'});
        [...col.children].filter(e=>e.classList.contains('seg')||e.classList.contains('slider')).forEach(e=>controls.append(e));
        const live=col.querySelector('.eqlive');
        parts[end-1].textContent='即時模型核對';
        col.append(controls,h('div',{class:'pose-live'},parts[end-1],live));
      }
      mode('完整推導','show-derivation');body.prepend(toolbar);
    }
    if(page===6||page===7){
      const sliders=[...body.querySelectorAll('input[type=range]')];
      const status=h('div',{class:'axis-status','aria-live':'polite'},'調整參數，觀察光路與耦合變化');
      if(page===7) body.querySelector('.sch').append(status);   // 計畫版：六軸場地建模頁不放底部狀態字卡
      sliders.forEach((input,i)=>input.addEventListener('input',()=>{
        body.querySelectorAll('.slider').forEach(e=>e.classList.remove('axis-active'));
        input.closest('.slider')?.classList.add('axis-active');
        const name=input.closest('.slider')?.querySelector('.sl-label')?.textContent||'';
        status.textContent='正在觀察：'+name;
        slide.dataset.activeAxis=String(i);
      }, { capture: true }));
      const reset = [...body.querySelectorAll('button')].find(button => button.textContent === '全部歸零');
      reset?.addEventListener('click', () => {
        delete slide.dataset.activeAxis;
        body.querySelectorAll('.slider').forEach(e => e.classList.remove('axis-active'));
        status.textContent = '調整參數，觀察光路與耦合變化';
      }, { capture: true });

    }
    if(page===2){
      const nodes=body.querySelectorAll('.tl .nd');
      nodes.forEach((n,i)=>n.classList.add(i<2?'previous-work':'new-work'));
      const kpis=body.querySelectorAll('.grid.grow > .grid > .card');
      const rows=body.querySelectorAll('.pr-ul li');
      kpis.forEach((k,i)=>{k.classList.add('result-card');k.dataset.result=String(i);});
      rows.forEach((row,i)=>{row.classList.add('result-row');row.tabIndex=0;
        const highlight=()=>kpis.forEach((k,j)=>k.classList.toggle('result-active',j===i));
        row.addEventListener('mouseenter',highlight);row.addEventListener('focus',highlight);
        row.addEventListener('mouseleave',()=>kpis.forEach(k=>k.classList.remove('result-active')));
        row.addEventListener('blur',()=>kpis.forEach(k=>k.classList.remove('result-active')));
      });
    }
    // Inspect source charts at presentation size without changing their data.
    body.querySelectorAll('.figc img').forEach(img=>{
      img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label','放大：'+img.alt);
      const open=()=>{
        const dialog=h('dialog',{class:'figure-dialog'},h('button',{type:'button',class:'btn',onclick:()=>dialog.close()},'關閉'),h('img',{src:img.src,alt:img.alt}));
        dialog.addEventListener('close',()=>dialog.remove());slide.append(dialog);dialog.showModal();
      };img.addEventListener('click',open);img.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();open();}});
    });
  });
}
