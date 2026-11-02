// 入口（計畫版）：以「整體計畫架構與關聯性」為中樞，點子計畫二字卡進該章，講完回架構圖。
// 原本各分頁模組照舊註冊投影片，先收進 pool（模組內共用狀態不變），再依字卡分章；沒排進任何章的頁不建立（程式還在）。
import { createDeck } from './deck.js';
import { h } from './ui.js';
import * as pageP from './pages/p_progress.js';
import * as pageB from './pages/b_edge.js';
import * as pageA from './pages/a_f2f.js';
import * as pageFA from './pages/fa_pic.js';
import * as pageC from './pages/c_lightpath.js';
import * as pageD from './pages/d_machine.js';
import * as pageSP21 from './pages/sp21_xy.js';
import * as pageSP21A from './pages/sp21_array.js';
import * as pageSP22 from './pages/sp22_camera.js';
import * as pageSP24 from './pages/sp24_aesc.js';
import * as pageSP26 from './pages/sp26_pose.js';
import { mountArch } from './pages/plan_arch.js';

// 各章（主線順序＝陣列順序）。pages 用標題開頭比對；同一頁也可以放進兩章（各建一份）。
// [開頭, 新標題]＝只在這一章換標題（11-02 使用者指定的計畫版標題）。
// 拿掉的頁：研究進度、PIC 的光模場、透鏡只是放在第幾層、結論（②）。⑥ f_measure.js 本來就沒掛。
const CHAPTERS = [
  { id: 'ma', sp: 'SP2-1', label: '2-1 模場建模', noNav: true, pages: ['XY 平面模場建模', ['Z 軸模場建模', 'Z 軸模場建模'], ['六軸場地', '六軸場地建模'], ['PIC 邊緣耦合', 'PIC 邊緣耦合'], ['光怎麼走進晶片', '三種實作方法'], ['陣列六軸建模（計畫版）', '陣列模場與六軸建模']] },   // 最後一頁 11-02 重做（sp21_array.js），原 fa_pic.js 那頁不再用
  { id: 'mb', sp: 'SP2-2', label: '2-2 影像粗對位', pages: ['高倍率相機', '雙視角 CNN', '最終相機模型'] },
  { id: 'mc', sp: 'SP2-3', label: '2-3 靈敏度分析', pages: [['六軸偏差', '六軸偏差靈敏度分析'], ['透鏡光纖', '透鏡光纖靈敏度分析']] },
  // 2-4（11-02 使用者指定）：AESC → 擾動法的極限 → 端面反射（雜訊來源）；Z 軸對位一度搬來，11-02 又改回 2-7
  { id: 'md', sp: 'SP2-4', label: '2-4 光功率量測', pages: ['AESC', '擾動法的極限', '端面反射'] },
  // 2-6：原本借用單光纖的六軸偏差頁，11-02 改成光纖陣列對 PIC 的姿態–功率配對頁（sp26_pose.js）
  { id: 'mf', sp: 'SP2-6', label: '2-6 數據採集', pages: ['六軸系統光功率回授'] },
  { id: 'mg', sp: 'SP2-7', label: '2-7 對位策略', pages: ['Z 軸對位', '三階段對位規劃', '陣列光纖對 PIC：對位策略', '旋轉中心與 XY 補償'] },
  { id: 'mh', sp: 'SP2-8', label: '2-8 多通道驗證', pages: ['怎麼定義光耦合成功'] },
  { id: 'v', sp: 'VAL', label: '實機驗證', pages: ['對位平台', '三段式對位', '化身光纖', '陣列光纖對 PIC：實機對位', '統整'] },
];

const deck = createDeck(document.getElementById('app'));
const ctx = {
  go: (id, i = 0) => { const si = deck.sections.findIndex((s) => s.id === id); if (si >= 0) deck.go(si, i); },
  // 依標題跳頁（頁會出現在哪一章由 CHAPTERS 決定，跨頁按鈕不寫死頁號）
  goTitle: (t) => { for (const [si, sec] of deck.sections.entries()) { const i = sec.slides.findIndex((q) => !q.opts.cover && q.opts.title.startsWith(t)); if (i >= 0) return deck.go(si, i); } },
};

const pool = [];
const fake = { slide: (opts, build) => pool.push({ opts, build }) };
for (const m of [pageP, pageB, pageA, pageC, pageFA, pageD, pageSP21, pageSP21A, pageSP22, pageSP24, pageSP26]) m.mount(fake, ctx);
const pick = (key) => {
  const s = pool.find((q) => (q.opts.cover ? key === '封面' : q.opts.title.startsWith(key)));
  if (!s) throw new Error('計畫版找不到投影片：' + key);
  return s;
};

// 導覽狀態：講完的章（看到該章最後一頁就算）、主線下一章
const tour = {
  chapters: CHAPTERS,
  done: new Set(),
  next() { return CHAPTERS.find((c) => !this.done.has(c.id)) || null; },
  enter(id) { ctx.go(id, 0); },
  home() { ctx.go('h', 1); },
};

deck.addSection('h', '架構圖', { mount(sec) { const c = pick('封面'); sec.slide(c.opts, c.build); mountArch(sec, tour); } }, ctx);
for (const ch of CHAPTERS) {
  deck.addSection(ch.id, ch.label, { mount(sec) { for (const k of ch.pages) {
    const [key, title] = Array.isArray(k) ? k : [k], s = pick(key);
    sec.slide(title ? { ...s.opts, title } : s.opts, s.build);
  } } }, ctx);
  const sec = deck.sections[deck.sections.length - 1];
  if (ch.noNav) continue;   // 這一章標題列右側不放頁碼與「架構圖」鈕（Esc、→ 照樣回架構圖）
  sec.slides.forEach((sl, k) => sl.el.querySelector('.stitle').append(h('div', { class: 'sptags chapnav' },
    h('span', { class: 'cn-pos' }, `${k + 1} / ${sec.slides.length}`),
    h('button', { type: 'button', class: 'cn-home', title: '回架構圖（Esc）', onclick: tour.home }, '⌂ 架構圖'))));
}

// 換頁規則：章內 ← → 照常；章的第一頁按 ← 或最後一頁按 → 回架構圖；架構圖按 → 進主線下一個還沒講的章
deck.stepHook = (d, { s, i }) => {
  const sec = deck.sections[s];
  if (sec.id === 'h') {
    if (d > 0 && i === 1) { const n = tour.next(); if (n) tour.enter(n.id); return true; }
    return false;
  }
  if ((d > 0 && i === sec.slides.length - 1) || (d < 0 && i === 0)) { tour.home(); return true; }
  return false;
};
deck.onGo = (sec, i) => { if (sec.id !== 'h' && i === sec.slides.length - 1) tour.done.add(sec.id); };
deck.onEsc = () => { if (deck.sections[deck.cur().s].id !== 'h') tour.home(); };

const style = h('style', null, `
.stitle .chapnav { gap:10px; align-items:center; }
.chapnav .cn-pos { font-family:var(--mono); font-size:16px; color:#93a6c6; }
.chapnav .cn-home { font:inherit; font-size:15px; font-weight:700; color:#1a1206; background:linear-gradient(135deg,#ffd29a,#ff8a3d); border:0; border-radius:8px; padding:3px 12px; cursor:pointer; }
.chapnav .cn-home:hover { filter:brightness(1.1); box-shadow:0 0 14px rgba(255,138,61,.55); }
`);
document.head.append(style);

deck.start();
// 實機驗證的三個機台 iframe 與化身光纖 3D 很重（每個約 1 s 載入）：開檔後停在封面時就在背景建好，報告中換頁不卡
// 六軸場地建模（2-1 第 3 頁）、六軸偏差的 3D 示意、三種實作方法（2-1 第 5 頁）的透鏡 3D 也一起（第一次建各約 0.1–0.3 s）
setTimeout(() => deck.prebuild('v', { done: () => deck.prebuild('ma', { only: [3, 5], done: () => deck.prebuild('mc', { only: [1] }) }) }), 2500);
