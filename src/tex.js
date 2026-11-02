// LaTeX → MathML（KaTeX，只輸出 MathML，Chrome 直接顯示，不必內嵌字型）
import katex from 'katex';
import { h } from './ui.js';
export function tex(expr, cls = '') {
  return h('div', { class: 'tex ' + cls, html: katex.renderToString(expr, { output: 'mathml', displayMode: true, throwOnError: false }) });
}
