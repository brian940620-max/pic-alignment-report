import { buildMachineSlide, microSlide, faMachineSlide, summarySlide, platformTour } from './machine_page.js';
import { h } from '../ui.js';
// ⑤ 對位平台（3+3+6）：機台導覽 → 三段式對位動畫 → 化身光纖 → 陣列光纖對 PIC → 統整
export function mount(sec) {
  const target = sec;
  let page = 0;
  sec = { slide(opts, build) { const index = ++page; target.slide(opts, body => {
    const slide = body.closest('.slide');
    slide.classList.add('edge-ui', 'machine-ui', `machine-page-${index}`);
    const hooks = build(body);
    if ([1, 2, 4].includes(index)) {
      const button = h('button', { type: 'button', class: 'machine-focus-button', 'aria-pressed': 'false', onclick: () => {
        const on = slide.classList.toggle('machine-focus');
        button.setAttribute('aria-pressed', String(on)); button.textContent = on ? '還原操作面板' : '放大機台';
        window.dispatchEvent(new Event('resize'));
      } }, '放大機台');
      slide.querySelector('.stitle').append(button);
    }
    return hooks;
  }); } };
  sec.slide({ title: '對位平台：3＋3＋6 堆疊式機台', sub: '' }, (body) => platformTour(body));
  sec.slide({ title: '三段式對位：每個元件怎麼動', sub: '' }, (body) => buildMachineSlide(body));
  sec.slide({ title: '化身光纖：一路對上 PIC，把光送進去', sub: '' }, (body) => microSlide(body));
  sec.slide({ title: '陣列光纖對 PIC：實機對位', sub: '先對好第 1 通道，再繞第 1 通道轉 θz 找第 8 通道' }, (body) => faMachineSlide(body));
  sec.slide({ title: '統整：誤差一路縮小，12 軸各司其職', sub: '毫米 → 微米 → 奈米' }, (body) => summarySlide(body));
}
