// Oblique stack diagram. Z spacing is linear; ellipse widths show the computed
// Gaussian sigma with a fixed display scale (not a physical 3D aspect ratio).
const views = new WeakMap();
export function sliceView(host, samples, current) {
  const y=z=>244-z*.95;
  const key = JSON.stringify(samples), cached = views.get(host);
  if (cached?.key === key) {
    const rx = current.width * 11, cy = y(current.z);
    cached.svg.setAttribute('aria-label', `Z 切片連動示意，目前 ${current.z} 微米`);
    for (const [name, value] of Object.entries({ cy, rx, ry: rx * .22 })) cached.ellipse.setAttribute(name, value);
    for (const [name, value] of Object.entries({ x1: 220 + rx, y1: cy, y2: cy })) cached.line.setAttribute(name, value);
    cached.text.setAttribute('y', cy + 5); cached.text.textContent = `${current.z} µm`;
    return;
  }
  const plane=(s,active)=>{
    const rx=s.width*11,ry=rx*.22,cy=y(s.z);
    return `<g><ellipse cx="220" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${active?'slice-current':'slice-light'})" fill-opacity="${active?.95:.28+.6*s.peak}" stroke="${active?'#fff0ca':'#8ddbe9'}" stroke-opacity="${active?1:.65}" stroke-width="${active?2.5:1.2}"/>
    ${active?`<line x1="${220+rx}" y1="${cy}" x2="400" y2="${cy}" stroke="#ffd49f"/><text x="407" y="${cy+5}" fill="#ffd49f">${s.z} µm</text>`:''}</g>`;
  };
  host.innerHTML=`<svg viewBox="0 0 530 290" role="img" aria-label="Z 切片連動示意，目前 ${current.z} 微米" style="width:100%;height:100%;display:block">
    <defs>
      <radialGradient id="slice-light"><stop stop-color="#ecfffb"/><stop offset=".38" stop-color="#6fe0e3"/><stop offset="1" stop-color="#1e738f" stop-opacity=".2"/></radialGradient>
      <radialGradient id="slice-current"><stop stop-color="#fffef1"/><stop offset=".4" stop-color="#ffdb91"/><stop offset="1" stop-color="#e9903e" stop-opacity=".35"/></radialGradient>
    </defs>
    <text x="14" y="21" fill="#dcebf5" font-size="16">Z 切片連動｜橙色為目前位置</text>
    <path d="${samples.map((s,i)=>`${i?'L':'M'} ${220-s.width*11} ${y(s.z)}`).join(' ')} ${samples.slice().reverse().map(s=>`L ${220+s.width*11} ${y(s.z)}`).join(' ')} Z" fill="#50cee0" fill-opacity=".06" stroke="#67cddd" stroke-opacity=".3"/>
    <line x1="220" y1="54" x2="220" y2="252" stroke="#beedf2" stroke-opacity=".35" stroke-dasharray="3 5"/>
    <line x1="72" y1="244" x2="72" y2="54" stroke="#8ba8bf"/>
    ${[0,50,100,150,200].map(z=>`<text x="15" y="${y(z)+5}" fill="#aac2d5" font-size="13">${z}</text><line x1="65" y1="${y(z)}" x2="80" y2="${y(z)}" stroke="#8ba8bf"/>`).join('')}
    <g font-size="15">${samples.map(s=>plane(s,false)).join('')}${plane(current,true)}</g>
    <text x="110" y="279" fill="#aac2d5" font-size="12">示意投影；橢圓半徑 ∝ s(Z)，亮度依峰值；Z 單位 µm</text></svg>`;
  const svg = host.querySelector('svg'), active = svg.querySelector('g[font-size="15"]').lastElementChild;
  views.set(host, { key, svg, ellipse: active.querySelector('ellipse'), line: active.querySelector('line'), text: active.querySelector('text') });
}
