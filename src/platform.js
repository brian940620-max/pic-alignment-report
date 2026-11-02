// 報價用 3D 機台（嵌入版，build.mjs 由單檔版產生 platform_embed.html，與簡報放同一資料夾）。用 iframe 載入，靠 postMessage 控制。
// 指令：view(all|stack|couple|inst)、demo、ang、stop、aside(on)、pins(on)、pose(p)、dpr(v)、hl(ids, color)
import { h } from './ui.js';

// 三階段各自用到的元件（報價網頁的編號）：粗動 R1、R2；角度 R5、R6；相機 R18；壓電 R3
export const STAGE_PARTS = {
  1: { ids: ['R1', 'R2', 'R5', 'R6'], color: 0x3b82f6 },
  2: { ids: ['R18', 'R1', 'R2', 'R5', 'R6'], color: 0x8b5cf6 },
  3: { ids: ['R3'], color: 0xff7a1a },
};

export class Platform {
  constructor(holder) {
    this.queue = []; this.ready = false;
    this.frame = h('iframe', { class: 'plat', title: '對位平台 3D', src: 'platform_embed.html', style: { width: '100%', height: '100%', border: '0', display: 'block', background: '#15171a' } });
    holder.append(this.frame);
    this.onMsg = (e) => {
      const d = e.data;
      if (!d || d.ns !== 'platform-out' || e.source !== this.frame.contentWindow) return;
      if (d.cmd === 'ready') { this.ready = true; this.dpr(); for (const m of this.queue) this.post(m); this.queue = []; this.onReady && this.onReady(); }
    };
    window.addEventListener('message', this.onMsg);
    this.onScale = () => this.dpr(); window.addEventListener('deckscale', this.onScale);
    // 簡報最多同時留著三個機台 iframe；不在畫面上的（換頁後 display:none）就叫它停止繪圖
    this.io = new IntersectionObserver((es) => this.send('active', { on: es[es.length - 1].isIntersecting }));
    this.io.observe(this.frame);
  }
  post(m) { this.frame.contentWindow && this.frame.contentWindow.postMessage({ ns: 'platform', ...m }, '*'); }
  send(cmd, extra = {}) { const m = { cmd, ...extra }; if (this.ready) this.post(m); else this.queue.push(m); }
  dpr() { if (this.ready) this.post({ cmd: 'dpr', v: Math.min(2.5, (window.devicePixelRatio || 1) * (window.__deckScale || 1)) }); }
  view(v) { this.send('view', { v }); }
  stage(n) { const s = STAGE_PARTS[n]; this.send('hl', s ? { ids: s.ids, color: s.color } : { ids: [] }); }
}
