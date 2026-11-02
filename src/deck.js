// 簡報框架：固定 1600×900 舞台等比縮放；分頁（section）底下有多張投影片（slide），鍵盤換頁，不捲動。
//
// 各分頁模組： export function mount(sec, ctx)
//   sec.slide({ title, sub }, (body) => { ...建內容到 body...; return { show(), hide() } /* 可省略 */ });
//   投影片內容在第一次顯示時才建立（延遲載入）。body 大小約 1544×760（CSS px，舞台座標），不可溢出、不可捲動。
import { h } from './ui.js';

export const STAGE_W = 1600, STAGE_H = 900;

export function createDeck(root) {
  const sections = [];
  let cur = { s: 0, i: 0 };
  const stage = h('div', { id: 'stage' });
  const top = h('div', { id: 'top' });
  const nav = h('nav', { id: 'nav' });
  const view = h('div', { id: 'deck' });
  const bar = h('div', { id: 'bar' });
  const dots = h('div', { class: 'dots' });
  const prev = h('button', { type: 'button', class: 'nb', onclick: () => step(-1) }, '‹');
  const next = h('button', { type: 'button', class: 'nb', onclick: () => step(1) }, '›');
  top.append(h('div', { class: 'brand' }, h('i', { class: 'logo' }), 'PIC 邊緣耦合'), nav);
  bar.append(h('div', { class: 'row', style: { gap: '18px' } }), dots, h('div', { class: 'navbtns' }, prev, next));
  stage.append(top, view, bar);
  root.append(stage);

  function fit() {
    const iw = window.innerWidth, ih = window.innerHeight;
    const s = Math.min(iw / STAGE_W, ih / STAGE_H);
    stage.style.transform = `translate(${(iw - STAGE_W * s) / 2}px, ${(ih - STAGE_H * s) / 2}px) scale(${s})`;
    window.__deckScale = s;
    window.dispatchEvent(new Event('deckscale'));
  }
  window.addEventListener('resize', fit);

  const deck = {
    sections,
    addSection(id, label, mod, ctx) {
      const sec = { id, label, slides: [], el: h('div', { class: 'section' }) };
      sec.slide = (opts, build) => {
        const body = h('div', { class: 'sbody' });
        const el = opts.cover ? h('section', { class: 'slide cover' }, body)
          : h('section', { class: 'slide' },
            h('div', { class: 'stitle' }, h('span', { class: 'kick' }, label.replace(/\s.*/, '')), h('h1', null, opts.title), opts.sub ? h('p', { class: 'sub' }, opts.sub) : null), body);
        sec.el.append(el);
        sec.slides.push({ el, body, build, opts, inst: null, built: false });
      };
      sec.btn = h('button', { type: 'button', onclick: () => go(sections.indexOf(sec), 0) }, label);
      nav.append(sec.btn);
      view.append(sec.el);
      sections.push(sec);
      mod.mount(sec, ctx);
      return sec;
    },
  };

  function total() { return sections.reduce((a, s) => a + s.slides.length, 0); }
  function flatIndex() { let n = 0; for (let k = 0; k < cur.s; k++) n += sections[k].slides.length; return n + cur.i; }

  function renderDots() {
    dots.replaceChildren();
    sections.forEach((sec, si) => {
      const g = h('span', { class: 'dg' });
      sec.slides.forEach((_, i) => g.append(h('i', { class: si === cur.s && i === cur.i ? 'on' : '', title: sec.slides[i].opts.title, onclick: () => go(si, i) })));
      dots.append(g);
    });
  }

  function ensureBuilt(sec, sl) {
    if (sl.built) return;
    sl.built = true;
    try { sl.inst = sl.build(sl.body, { sec, deck }) || {}; }
    catch (e) { console.error(e); sl.body.append(h('div', { class: 'note warn' }, `本頁載入失敗：${e.message}`)); sl.inst = {}; }
  }
  // 預先建好某一節的投影片（不顯示）：重的頁面（機台 iframe）在封面時就先載入，報告中換頁不必等。
  // 一頁一頁來，中間留空檔，避免一次卡太久。
  // only：只建這幾頁（1 起算）；done：全部建完後呼叫
  deck.prebuild = (id, { only = null, gap = 1500, done = null } = {}) => {
    const sec = sections.find((x) => x.id === id); if (!sec) return;
    const todo = sec.slides.filter((sl, k) => !sl.built && (!only || only.includes(k + 1)));
    const next = () => { const sl = todo.shift(); if (!sl) { done && done(); return; } ensureBuilt(sec, sl); setTimeout(next, gap); };
    next();
  };

  function go(s, i, push = true) {
    s = Math.max(0, Math.min(sections.length - 1, s));
    i = Math.max(0, Math.min(sections[s].slides.length - 1, i));
    const old = sections[cur.s]?.slides[cur.i];
    if (old && old.inst && old.inst.hide && (cur.s !== s || cur.i !== i)) old.inst.hide();
    for (const sec of sections) for (const sl of sec.slides) sl.el.classList.remove('on');
    cur = { s, i };
    const sec = sections[s], sl = sec.slides[i];
    sl.el.classList.add('on');
    stage.classList.toggle('is-cover', !!sl.opts.cover);
    sections.forEach((x, k) => x.btn.classList.toggle('on', k === s));
    ensureBuilt(sec, sl);
    if (sl.inst.show) requestAnimationFrame(() => sl.inst.show());
    renderDots();
    prev.disabled = flatIndex() === 0; next.disabled = flatIndex() === total() - 1;
    if (push) history.replaceState(null, '', `#${sec.id}${i + 1}`);
    window.dispatchEvent(new Event('deckscale'));   // 讓剛顯示的畫布依實際大小重畫
    if (deck.onGo) deck.onGo(sec, i);
  }
  function step(d) {
    if (deck.stepHook && deck.stepHook(d, cur)) return;   // 計畫版：章節導覽（main.js）可以接手換頁
    let { s, i } = cur;
    i += d;
    if (i < 0) { if (s === 0) return; s--; i = sections[s].slides.length - 1; }
    else if (i >= sections[s].slides.length) { if (s === sections.length - 1) return; s++; i = 0; }
    go(s, i);
  }

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.target.matches && e.target.matches('textarea, input[type=text], input[type=number], select')) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && !e.target.matches('button'))) { e.preventDefault(); step(1); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); step(-1); }
    else if (k === 'Home') { e.preventDefault(); go(0, 0); }
    else if (k === 'End') { e.preventDefault(); go(sections.length - 1, sections[sections.length - 1].slides.length - 1); }
    else if (/^[1-9]$/.test(k) && +k <= sections.length) go(+k - 1, 0);
    else if (k === 'Escape' && deck.onEsc && !document.querySelector('dialog[open]')) { e.preventDefault(); deck.onEsc(); }
    else if (k === 'f' || k === 'F') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); }
  });
  // 拖完滑桿或按完按鈕後取消焦點，避免方向鍵被滑桿吃掉
  window.addEventListener('pointerup', () => { const a = document.activeElement; if (a && a.matches && a.matches('input[type=range], button')) setTimeout(() => a.blur(), 0); });
  window.addEventListener('hashchange', () => parseHash(false));

  function parseHash(push) {
    const m = /^#([a-z]+)(\d+)?$/.exec(location.hash);
    if (m) { const si = sections.findIndex((x) => x.id === m[1]); if (si >= 0) return go(si, (+m[2] || 1) - 1, push); }
    go(0, 0, push);
  }
  deck.start = () => { fit(); parseHash(false); };
  deck.go = go;
  deck.cur = () => cur;
  return deck;
}
