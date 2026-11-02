// Oblique stack diagram. Z spacing is linear; ellipse widths show the computed
// Gaussian sigma with a fixed display scale (not a physical 3D aspect ratio).
export function sliceView(host, samples, current) {
  const y=z=>244-z*.95;
  const plane=(s,active)=>{
    const rx=s.width*7,ry=rx*.22,cy=y(s.z);
    return `<g><ellipse cx="220" cy="${cy}" rx="${rx}" ry="${ry}" fill="${active?'#f1bc78':'#80c7e5'}" fill-opacity="${active?.45:.08+.25*s.peak}" stroke="${active?'#ffd49f':'#54758f'}" stroke-width="${active?2:1}"/>
    ${active?`<line x1="${220+rx}" y1="${cy}" x2="400" y2="${cy}" stroke="#ffd49f"/><text x="407" y="${cy+5}" fill="#ffd49f">${s.z} µm</text>`:''}</g>`;
  };
  host.innerHTML=`<svg viewBox="0 0 530 290" role="img" aria-label="Z 切片連動示意，目前 ${current.z} 微米" style="width:100%;height:100%;display:block">
    <text x="14" y="21" fill="#dcebf5" font-size="16">Z 切片連動｜橙色為目前位置</text>
    <line x1="72" y1="244" x2="72" y2="54" stroke="#8ba8bf"/>
    ${[0,50,100,150,200].map(z=>`<text x="15" y="${y(z)+5}" fill="#aac2d5" font-size="13">${z}</text><line x1="65" y1="${y(z)}" x2="80" y2="${y(z)}" stroke="#8ba8bf"/>`).join('')}
    <g font-size="15">${samples.map(s=>plane(s,false)).join('')}${plane(current,true)}</g>
    <text x="110" y="279" fill="#aac2d5" font-size="12">示意投影；橢圓半徑 ∝ s(Z)，亮度依峰值；Z 單位 µm</text></svg>`;
}
