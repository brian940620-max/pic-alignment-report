// 計畫版第 2 頁：整體計畫架構與關聯性（照國科會 116 整體計畫架構圖重畫）
// 滑鼠停在子計畫二的字卡上：該字卡與跨計畫相關的字卡、連線亮起，其他變暗；離開就恢復全圖。
// 座標沿用原圖（1584×898 投影片）的像素尺度，再用 X()/Y() 換到本頁畫布。子計畫二放中間列（原圖在最下面），線依新位置重繞。
import { h } from '../ui.js';

const W = 1530, H = 748, SY = 1.14;
const X = (x) => x - 26, Y = (y) => (y - 148) * SY;

// 字卡欄位（左緣 x）與三列（上緣 y）：子一上、子二中、子三下。字卡比原圖窄一點，欄間留 20 讓線穿過
const COL = [206, 365, 524, 683, 842, 1001, 1160, 1372], CW = 139, CH = 100;
const ROW = { 1: 167, 2: 412, 3: 662 };
const cx = (c) => COL[c] + CW / 2;            // 第 c 欄字卡中線
const gx = (c) => COL[c] + CW + (159 - CW) / 2; // 第 c 與 c+1 欄之間的空隙
const T = 267, MT = 411, MB = 513, B = 661;   // 上列底、中列頂、中列底、下列頂（箭頭端點）
const CARDS = [
  ['SP1-1', 1, 0, '順/逆', '運動學建模'], ['SP1-2', 1, 1, '組裝公差與', '變形誤差分析'], ['SP1-3', 1, 2, '幾何參數鑑別'],
  ['SP1-4', 1, 3, '致動器', '非線性補償'], ['SP1-5', 1, 4, '強健', '內迴路控制'], ['SP1-6', 1, 5, '奈米軌跡與', '高頻寬追蹤'],
  ['SP1-7', 1, 6, '對位控制整合', '結合 PINN 前饋'], ['SP1-8', 1, 7, '平台精度與', '頻寬實機驗證'],
  ['SP3-1', 3, 0, '多物理場', '數位雙生'], ['SP3-2', 3, 1, 'PINN', '物理損失函數'], ['SP3-3', 3, 2, 'PINN 預訓練', '與收斂分析'],
  ['SP3-4', 3, 3, '小樣本', 'Sim-to-Real 模型'], ['SP3-5', 3, 4, '誤差源', '分離辨識'], ['SP3-6', 3, 6, 'PINN 輕量化', '即時控制'],
  ['SP3-7', 3, 7, 'PINN 快速對位', '全系統驗證'],
  ['SP2-1', 2, 0, 'PIC 邊緣耦合', '模場建模與辨識'], ['SP2-2', 2, 1, '機器學習', '影像粗對位'], ['SP2-3', 2, 2, '六軸耦合損耗', '與靈敏度分析'],
  ['SP2-4', 2, 3, '高速低雜訊', '光功率回授與', '高動態範圍量測'], ['SP2-5', 2, 4, '即時梯度', '觀測器'], ['SP2-6', 2, 5, '姿態-光功率配對', '數據自動化採集'],
  ['SP2-7', 2, 6, '高速高精度', '對位策略'], ['SP2-8', 2, 7, 'PIC/FA 多通道對', '位速度與耦合效', '率實機驗證'],
];
const BANDS = [
  [1, '子計畫一', 'Stewart 平台', '奈米級定位控制', 150, 284],
  [2, '子計畫二', 'PIC 邊緣耦合', '對位與檢測', 390, 534],
  [3, '子計畫三', 'Sim-to-Real', '數位雙生 (PINN)', 640, 800],
];
// 同一列的流程箭頭（粗＝送到驗證欄或跨大段）
const FLOW = [
  ...[1, 3, 2].flatMap((r) => [0, 1, 2, 3, 4, 5].filter((c) => !(r === 3 && c >= 4)).map((c) => [r, c, c + 1, false])),
  [3, 4, 6, true], [1, 6, 7, true], [3, 6, 7, true], [2, 6, 7, true],
];
// 跨計畫連線：[起, 迄, 顏色(起點所屬子計畫), 標籤, 標籤位置, 折線點]；起迄關係照原圖，路徑因子二移到中間而重繞。
// 子一 → 子三的線從第 1、2 欄間的空隙穿過子二列；進同一張子三字卡時，子一的線在左（cx-28）、子二的在右（cx+25）
const LINKS = [
  ['SP1-1', 'SP3-1', 1, '物理模型', [cx(0) - 28, 636], [[cx(0), T], [cx(0), 295], [gx(0), 295], [gx(0), 610], [cx(0) - 28, 610], [cx(0) - 28, B]]],
  ['SP1-1', 'SP3-2', 1, '物理約束', [cx(1) - 28, 636], [[cx(0), T], [cx(0), 295], [gx(0), 295], [gx(0), 610], [cx(1) - 28, 610], [cx(1) - 28, B]]],
  ['SP1-1', 'SP3-3', 1, '數據', [cx(2) - 28, 636], [[cx(0), T], [cx(0), 295], [gx(0), 295], [gx(0), 610], [cx(2) - 28, 610], [cx(2) - 28, B]]],
  ['SP1-6', 'SP2-4', 1, '奈米軌跡', [cx(5), 308], [[cx(5), T], [cx(5), 345], [cx(3) + 25, 345], [cx(3) + 25, MT]]],
  ['SP1-6', 'SP2-5', 1, '奈米軌跡', [cx(5), 308], [[cx(5), T], [cx(5), 345], [cx(4) + 25, 345], [cx(4) + 25, MT]]],
  ['SP2-1', 'SP3-1', 2, '物理模型', [cx(0) + 25, 572], [[cx(0) + 25, MB], [cx(0) + 25, B]]],
  ['SP2-1', 'SP3-3', 2, '數據', [cx(2) + 25, 585], [[cx(0) + 50, MB], [cx(0) + 50, 545], [cx(2) + 25, 545], [cx(2) + 25, B]]],
  ['SP2-3', 'SP3-2', 2, '物理約束', [(cx(1) + cx(2)) / 2, 578], [[cx(2) - 20, MB], [cx(2) - 20, 578], [cx(1) + 25, 578], [cx(1) + 25, B]]],
  ['SP2-4', 'SP3-4', 2, '掃描數據', [cx(3), 585], [[cx(3), MB], [cx(3), B]]],
  ['SP2-6', 'SP1-7', 2, '配對數據', [(cx(5) + 40 + cx(6) - 20) / 2 + 6, 360], [[cx(5) + 40, MT], [cx(5) + 40, 360], [cx(6) - 20, 360], [cx(6) - 20, T + 1]]],
  ['SP2-7', 'SP1-7', 2, '對位策略', [cx(6) + 30, 333], [[cx(6) + 30, MT], [cx(6) + 30, T + 1]]],
  ['SP3-5', 'SP2-5', 3, '誤差預補償', [cx(4) - 6, 578], [[cx(4), B + 1], [cx(4), MB]]],
  ['SP3-5', 'SP1-7', 3, '誤差預補償', [1050, 615], [[cx(4) + 30, B + 1], [cx(4) + 30, 615], [gx(5), 615], [gx(5), 300], [cx(6) - 50, 300], [cx(6) - 50, T + 1]]],
  ['SP3-6', 'SP1-7', 3, 'PINN 模型', [1318, 575], [[cx(6) + 35, B + 1], [cx(6) + 35, 615], [1318, 615], [1318, 300], [cx(6) + 55, 300], [cx(6) + 55, T + 1]]],
  ['SP3-1', 'SP3-3', 3, '合成數據', [cx(1), 782], [[cx(0) + 30, 763], [cx(0) + 30, 782], [cx(2), 782], [cx(2), 764]]],
];

const CSS = `
.arch { position:absolute; left:0; top:0; width:${W}px; height:${H}px; transform-origin:0 0; --c1:#5fd068; --c3:#b48cff; --c2:#ffb547; }
.arch .band { position:absolute; border-radius:18px; border:1.5px solid; }
.arch .band.r1 { background:rgba(95,208,104,.07); border-color:rgba(95,208,104,.45); }
.arch .band.r3 { background:rgba(180,140,255,.08); border-color:rgba(180,140,255,.45); }
.arch .band.r2 { background:rgba(255,181,71,.09); border-color:rgba(255,181,71,.55); }
.arch .blab { position:absolute; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; line-height:1.35; color:#dfe8fa; font-size:17px; }
.arch .blab b { font-size:22px; color:#fff; letter-spacing:2px; margin-bottom:2px; }
.arch .val { position:absolute; border-radius:22px; background:rgba(160,172,196,.10); border:1.5px solid rgba(160,172,196,.35); }
.arch .val span { position:absolute; left:0; right:0; text-align:center; font-size:27px; font-weight:800; letter-spacing:3px; color:#e8eefb; }
.arch .card { position:absolute; border-radius:12px; border:2px solid; display:flex; flex-direction:column; align-items:center; justify-content:center;
  text-align:center; color:#e8eefb; font-size:16px; line-height:1.32; padding:4px 6px; box-sizing:border-box; transition:opacity .2s, box-shadow .2s, transform .2s, filter .2s; }
.arch .card b { font-size:20px; color:#fff; margin-bottom:3px; letter-spacing:.5px; }
.arch .card.r1 { background:rgba(40,110,52,.55); border-color:var(--c1); }
.arch .card.r3 { background:rgba(88,58,150,.55); border-color:var(--c3); }
.arch .card.r2 { background:rgba(140,88,10,.55); border-color:var(--c2); cursor:pointer; }
.arch .card.small { font-size:14px; }
.arch svg { position:absolute; left:0; top:0; overflow:visible; pointer-events:none; }
.arch svg path { fill:none; transition:opacity .2s, stroke-width .2s; }
.arch .lk { stroke-width:2.2; }
.arch .lk.r1 { stroke:var(--c1); } .arch .lk.r3 { stroke:var(--c3); } .arch .lk.r2 { stroke:var(--c2); }
.arch .fl { stroke:#c8d3e8; stroke-width:2.4; } .arch .fl.thick { stroke-width:5; }
.arch .tag { position:absolute; transform:translate(-50%,-50%); white-space:nowrap; font-size:15px; padding:1px 8px; border-radius:6px; background:#0b1426; border:1.5px solid; color:#e8eefb; transition:opacity .2s, transform .2s, box-shadow .2s; }
.arch .tag.r1 { border-color:var(--c1); } .arch .tag.r3 { border-color:var(--c3); } .arch .tag.r2 { border-color:var(--c2); }
/* 聚焦：滑鼠停在子計畫二字卡上 */
.arch.focus .card, .arch.focus .tag, .arch.focus .lk, .arch.focus .fl { opacity:.12; }
.arch.focus .card.r2 { opacity:.38; }
.arch.focus .band, .arch.focus .blab, .arch.focus .val { opacity:.55; transition:opacity .2s; }
.arch.focus .card.hot { opacity:1; transform:scale(1.06); z-index:3; box-shadow:0 0 0 2px #fff, 0 0 26px var(--glow-c); filter:brightness(1.25); }
.arch.focus .card.hot.self { transform:scale(1.1); }
.arch.focus .lk.hot { opacity:1; stroke-width:4.5; filter:drop-shadow(0 0 6px var(--glow-c)); }
.arch.focus .tag.hot { opacity:1; transform:translate(-50%,-50%) scale(1.15); z-index:4; box-shadow:0 0 14px var(--glow-c); font-weight:700; }
/* 分章入口 */
.arch .card.r1, .arch .card.r3 { pointer-events:none; }   /* 子一、子三字卡不攔滑鼠：點驗證欄裡的 1-8、3-7 也算點到驗證欄 */
.arch .go { cursor:pointer; }
.arch .pg { position:absolute; right:-7px; top:-11px; font-style:normal; font-size:12px; font-weight:700; line-height:1; padding:3px 7px; border-radius:99px;
  background:#ffb547; color:#1a1206; box-shadow:0 0 0 2px #0b1426; white-space:nowrap; }
.arch .val .pg { right:14px; top:14px; font-size:14px; padding:4px 10px; }
.arch .card.plan { border-style:dashed; background:rgba(140,88,10,.22); cursor:default; }
.arch .card.plan .pg { background:#3a3020; color:#d9c39a; }
.arch .done .pg { background:#2f9e44; color:#fff; }
.arch .done .pg::before { content:'✓ '; }
.arch .val.go:hover { background:rgba(160,172,196,.18); border-color:rgba(220,228,245,.7); }
.arch .card.go:not(.plan):hover .pg { filter:brightness(1.15); }
.arch .next { animation:archNext 1.6s ease-in-out infinite; }
@keyframes archNext { 0%,100% { box-shadow:0 0 0 0 rgba(255,181,71,0); } 50% { box-shadow:0 0 0 4px rgba(255,181,71,.55), 0 0 22px rgba(255,181,71,.5); } }
.arch.focus .next { animation:none; }
.arch .r1 { --glow-c:rgba(95,208,104,.85); } .arch .r3 { --glow-c:rgba(180,140,255,.85); } .arch .r2 { --glow-c:rgba(255,181,71,.9); }
`;

// tour（main.js）：{ chapters:[{id, sp, pages}], done:Set, next(), enter(id) }；不給就只有 hover
export function mountArch(sec, tour) {
  sec.slide({ title: '整體計畫架構與關聯性', sub: '' }, (body) => {
    const box = {};
    const arch = h('div', { class: 'arch' });
    const px = (x, y, w, hh) => ({ left: `${X(x)}px`, top: `${Y(y)}px`, width: `${w}px`, height: `${hh * SY}px` });

    for (const [r, t, a, b, y0, y1] of BANDS) {
      arch.append(h('div', { class: `band r${r}`, style: px(33, y0, X(1320) - X(33), y1 - y0) }));
      arch.append(h('div', { class: 'blab', style: px(40, y0, 160, y1 - y0) }, h('b', null, t), a, h('br'), b));
    }
    const val = h('div', { class: 'val', style: px(1340, 150, 1551 - 1340, 800 - 150) }, h('span', { style: { top: `${Y(318) - Y(150)}px` } }, '合作共同驗證'));
    arch.append(val);

    // 線在字卡底下，標籤在字卡上面
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    const defs = document.createElementNS(ns, 'defs');
    defs.innerHTML = [['a1', '#5fd068'], ['a3', '#b48cff'], ['a2', '#ffb547'], ['af', '#c8d3e8']]
      .map(([id, c]) => `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`).join('');
    svg.append(defs);
    arch.append(svg);
    const path = (pts, cls, mk) => {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', pts.map(([x, y], k) => `${k ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(' '));
      p.setAttribute('class', cls); p.setAttribute('marker-end', `url(#${mk})`);
      svg.append(p); return p;
    };

    for (const [r, c0, c1, thick] of FLOW) {
      const y = ROW[r] + CH / 2, x0 = COL[c0] + CW, x1 = COL[c1];
      path([[x0, y], [x1 - 1, y]], `fl${thick ? ' thick' : ''}`, 'af');
    }
    const links = LINKS.map(([from, to, r, label, [lx, ly], pts]) => {
      const p = path(pts, `lk r${r}`, `a${r}`);
      const t = h('div', { class: `tag r${r}`, style: { left: `${X(lx)}px`, top: `${Y(ly)}px` } }, label);
      return { from, to, p, t };
    });

    for (const [id, r, c, ...lines] of CARDS) {
      const el = h('div', { class: `card r${r}${lines.length > 2 || lines.join('').length > 14 ? ' small' : ''}`, style: px(COL[c], ROW[r], CW, CH) },
        h('b', null, id), ...lines.flatMap((t, k) => (k ? [h('br'), t] : [t])));
      box[id] = el; arch.append(el);
    }
    for (const lk of links) arch.append(lk.t);

    // 聚焦：只對子計畫二的字卡；標籤重疊時（奈米軌跡兩條共用）兩個都亮也一樣
    const clear = () => {
      arch.classList.remove('focus');
      for (const el of Object.values(box)) el.classList.remove('hot', 'self');
      for (const lk of links) { lk.p.classList.remove('hot'); lk.t.classList.remove('hot'); }
    };
    for (const [id, r] of CARDS) {
      if (r !== 2) continue;
      box[id].addEventListener('mouseenter', () => {
        clear();
        arch.classList.add('focus');
        box[id].classList.add('hot', 'self');
        for (const lk of links) {
          if (lk.from !== id && lk.to !== id) continue;
          lk.p.classList.add('hot'); lk.t.classList.add('hot');
          box[lk.from === id ? lk.to : lk.from].classList.add('hot');
        }
      });
      box[id].addEventListener('mouseleave', clear);
    }

    // 分章：有章的字卡（與右側合作共同驗證欄）點了進該章；角落標頁數，講過的標「✓」，主線下一章外框呼吸
    const chOf = {}, entry = [];
    for (const ch of tour ? tour.chapters : []) {
      const el = ch.sp === 'VAL' ? val : box[ch.sp];
      chOf[ch.id] = el;
      el.classList.add('go');
      el.append(h('i', { class: 'pg' }, `${ch.pages.length} 頁`));
      el.addEventListener('click', () => tour.enter(ch.id));
      entry.push(ch.sp);
    }
    for (const [id, r] of CARDS) if (r === 2 && tour && !entry.includes(id)) { box[id].classList.add('plan'); box[id].append(h('i', { class: 'pg' }, '規劃中')); }
    const marks = () => {
      if (!tour) return;
      const nx = tour.next();
      for (const [id, el] of Object.entries(chOf)) { el.classList.toggle('done', tour.done.has(id)); el.classList.toggle('next', !!nx && nx.id === id); }
    };

    body.append(h('style', null, CSS), arch);
    // 依本頁實際大小等比縮放整張圖並置中
    const fit = () => {
      const s = Math.min(body.clientWidth / W, body.clientHeight / H);
      if (!(s > 0)) return;
      arch.style.transform = `translate(${(body.clientWidth - W * s) / 2}px, 0) scale(${s})`;
    };
    window.addEventListener('deckscale', fit);
    return { show() { fit(); marks(); }, hide: clear };
  });
}
