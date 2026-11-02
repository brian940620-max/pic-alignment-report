// 獨立公開專案：npm run build → dist/（入口 index.html）。整個 dist/ 才是可搬移的網站。
// source/platform.html、assets/ 與 test/fixtures/ 均隨儲存庫提供，不依賴原研究目錄。
//
// 另外把 source/platform.html（原報告的 3D 機台來源、照片已內嵌）轉成嵌入版
// platform_embed.html（約 9 MB，不追蹤）：three.js 改由 node_modules 打包（不用網路）、預設深色、隱藏報價側欄與工具列，
// 套用「完整建議版」＋晶片模組（O4 吸盤、O5 懸臂、O6 透鏡光纖）＝透鏡光纖對 PIC，
// 並加上 postMessage 介面讓簡報控制鏡頭、對位動畫、角度驗證、三階段姿態與元件高亮。
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('.', import.meta.url)));
mkdirSync('dist/platform_img', { recursive: true });
cpSync('assets', 'dist/assets', { recursive: true });

const PLATFORM_SRC = 'source/platform.html';
const EMBED_API = `
/* ==== 嵌入簡報用（build.mjs 加入）==== */
{
  const post=(o)=>parent.postMessage(Object.assign({ns:'platform-out'},o),'*');
  addEventListener('message',(e)=>{const d=e.data;if(!d||d.ns!=='platform')return;
    switch(d.cmd){
      case 'view': view(d.v); break;
      case 'stop': stopDemo(); stopAng(); M.car1.position.x=0;M.car2.position.z=0;M.car3.position.y=0;M.pitch.rotation.set(0,0,0);M.yaw.rotation.set(0,0,0);M.roll.rotation.set(0,0,0);M.pz.position.set(0,0,0);M.pzR.rotation.set(0,0,0);setPower(0);rebuildCables(); break;
      case 'demo': M.pzR.rotation.set(0,0,0); if(!demo) bDemo.onclick(); break;
      case 'ang': if(ang) stopAng(); startAng(d.axes||[0,1,2]); break;
      case 'preset': applyPreset(d.v); break;
      case 'aside': document.body.classList.toggle('show-aside',!!d.on); setTimeout(resize,40); break;
      case 'pins': if(bPins.classList.contains('on')!==!!d.on) bPins.onclick(); break;
      case 'pose': { if(demo) stopDemo(); if(ang) stopAng(); const p=d.p;
        M.car1.position.x=p.cz;M.car2.position.z=p.cx;M.car3.position.y=p.cy;
        M.pitch.rotation.z=p.pitch;M.yaw.rotation.y=p.yaw;M.roll.rotation.x=p.roll||0;
        M.pz.position.set(p.pz||0,p.py,p.px);M.pzR.rotation.set(p.ptz||0,p.ptx||0,p.pty||0);setPower(p.power);rebuildCables(); break; }
      case 'focus': if(parts[d.id]) focus(d.id); break;
      case 'axes': axes.visible=!!d.on; bAxes.classList.toggle('on',!!d.on); break;
      case 'hide': for(const id of d.ids||[])for(const g of parts[id]||[])g.visible=!d.on&&shown(g); break;
      case 'cam': flyTo(V(...d.p),V(...d.t),d.ms||950); break;
      case 'head': S.fix=d.v; if(d.v==='fa'){S.chk.add('O7');S.chk.add('O8')} refresh(); FAWG.forEach(m=>m.visible=d.v==='fa'); WG1&&(WG1.visible=d.v!=='fa'); break;
      case 'chpow': (d.p||[]).forEach((v,i)=>{if(FAWG[i]){FAWG[i].material.emissiveIntensity=.15+3*v;FAWG[i].material.color.setHex(v>.05?0xff7a3d:0x6b2a20)}}); break;
      case 'pzpivot': M.pzR.position.z=d.z||0; M.pzR.children[0].position.z=-(d.z||0); break;
      case 'dpr': renderer.setPixelRatio(Math.min(3,d.v)); resize(); break;
      case 'hl': hl(d.ids||[],d.color); break;
      case 'teaching': platformHighlightStrength=d.on?.55:.12; hl(lastHighlightIds,lastHighlightColor); break;
    }});
  // 陣列模式：晶片上 8 條波導（對齊陣列夾具頭的 8 個通道），各自依功率發光；單通道模式只留原本那條
  const chipP=parts.DUT[0], WG1=chipP.children.find(o=>o.isMesh&&o.material===M.wg), FAWG=[];
  for(let k=0;k<8;k++){const m=new THREE.Mesh(new THREE.BoxGeometry(10.02,0.12,0.09),new THREE.MeshStandardMaterial({color:0x6b2a20,emissive:0xff5a2a,emissiveIntensity:.15}));m.position.set(5,FY+0.24,-0.875+k*0.25);m.visible=false;chipP.add(m);FAWG.push(m)}
  // 元件高亮（三階段各自發光）：記住原本的自發光，換一組就還原
  const HL=new Map();
  let lastHighlightIds=[],lastHighlightColor;
  function hl(ids,color){lastHighlightIds=ids;lastHighlightColor=color;for(const [m,v] of HL){m.emissive.setHex(v[0]);m.emissiveIntensity=v[1]}HL.clear();
    for(const id of ids)for(const g of (parts[id]||[]))g.traverse(o=>{if(o.isMesh&&o.material&&o.material.emissive&&!HL.has(o.material)){HL.set(o.material,[o.material.emissive.getHex(),o.material.emissiveIntensity]);o.material.emissive.setHex(color||0xff8a3d);o.material.emissiveIntensity=platformHighlightStrength}})}
  applyPreset('full');
  ['O4','O5','O6'].forEach(k=>S.chk.add(k)); refresh(); view('all');
  post({cmd:'ready'});
}
`;
const EMBED_CSS = `
#app{grid-template-columns:1fr !important;grid-template-rows:none !important;height:100vh}
aside{display:none !important}
body.show-aside #app{grid-template-columns:1fr 400px !important}
body.show-aside aside{display:flex !important;border-left:1px solid var(--line)}
#bar{display:none !important}
#hint{font-size:11px}
`;

async function buildPlatform() {
  const src = readFileSync(PLATFORM_SRC, 'utf8');
  const m = src.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('報價網頁找不到 module script');
  const must = (s, a, b) => { if (!s.includes(a)) throw new Error('報價網頁找不到：' + a); return s.replace(a, b); };
  let code = m[1];
  code = must(code, "const dark=matchMedia('(prefers-color-scheme: dark)').matches;", 'const dark=true;');
  // 老師的配置是 3+3+6：報價網頁的 P-616（XYZ 三軸）在簡報裡換成 6 軸奈米壓電（型號待定，外型與高度沿用 P-616 當示意，
  // 旋轉中心維持在光纖端面）。壓電的三個角度軸＝夾在壓電與快換座之間、以光纖端面為中心的 M.pzR。報價網頁原檔不動。
  code = must(code, "M.ex5=grp(M.pz);", "const [pzRG,pzRI]=pivot(M.pz,TIPX,FY,0);M.pzR=pzRG;M.ex5=grp(pzRI);");
  code = must(code, "['R3','精動 XYZ（壓電）','壓電奈米平台 NanoCube','PI P-616.3C',1,290000,380000,'E',IMG['03_P-616.jpg'],'繞圈梯度法的核心：讓光纖畫 0.7 µm 的小圓，也負責 First Light 螺旋掃描（±50 µm）。',['40 × 40 × 40 mm、80 g；XYZ 閉迴路行程各 100 µm、解析度 0.4 nm','共振頻率：空載 700 Hz、負載 38 g 時 380 Hz、100 g 時 250 Hz（±20%，PI 規格）'",
    "['R3','精動 6 軸（壓電）','6 軸奈米壓電平台（XYZ＋θx、θy、θz）','型號待定',1,290000,380000,'E',null,'精對位的核心：讓光纖畫 0.7 µm 的小圓、做 First Light 螺旋掃描，最後用三個角度軸微調傾角；旋轉中心要落在光纖端面。',['3D 外型與高度沿用原 P-616 的位置（示意），實際尺寸、行程與角度範圍依選定型號','價格仍是原 P-616 的報價，6 軸型號確定後再更新'");
  code = must(code, "['R4','精動 XYZ（壓電）','數位壓電控制器（驅動器，類比輸入版）','PI E-727.3CDA',1,256000,320000,'E',IMG['04_E-727.jpg'],'驅動 P-616 三軸、讀電容感測器做閉迴路。'",
    "['R4','精動 6 軸（壓電）','6 軸壓電驅動器（類比輸入）','型號待定（配合壓電台）',1,256000,320000,'E',null,'驅動 6 軸壓電、讀回各軸位置感測器。'");
  code = must(code, "txt('PI P-616',20,6,", "txt('6 軸壓電',20,6,");
  code = must(code, "H$('aPL').textContent='P-616 本體移動量'", "H$('aPL').textContent='壓電本體移動量'");
  // 2026-10-31 逐頁查核：側欄沿用 P-616／E-727 的地方標明是示意；照片與實際型號不同的標「參考圖」；報價漏項加註。
  // 只比對字串內容（不含引號），每條必須剛好出現一次，否則中止建置
  const once = (s, a, b) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error(`報價網頁「${a}」出現 ${n} 次（應為 1）`); return s.replace(a, b); };
  for (const [a, b] of [
    ['所以上面的夾具頭要越輕越好', '夾具頭要越輕越好'],
    ['也就是約 50–80 Hz；', '50–80 Hz 是以原 P-616 帶 100 g 時約 250 Hz 推算，換型號要重算；'],
    ['必須是 .xxxA 類比輸入版本，擷取卡才能用電壓直接畫圓', '價格與以下規格仍是原 PI E-727.3CDA 的（示意），6 軸型號確定後再更新；必須是類比輸入版本，擷取卡才能用電壓直接畫圓'],
    ['類比輸入：Sub-D 15 針，4 路 ±10 V、18 bit；控制取樣 20 kHz', '（E-727）類比輸入：Sub-D 15 針，4 路 ±10 V、18 bit；6 軸需要 6 路，選型時要確認'],
    ["'PI','E-727 Digital Piezo Controller'", "'6 軸壓電驅動器','型號待定'"],
    ["name:'PI P-616＋E-727',note:'電容感測，共振頻率最高 700 Hz'", "name:'6 軸壓電（型號待定，以 PI P-616＋E-727 示意）',note:'原 P-616 規格：電容感測，空載共振 700 Hz'"],
    ['E：P-616 墊塊 10.5 mm（讓光纖端剛好落在旋轉中心）', 'E：壓電墊塊，厚度＝54.5 mm − 壓電台高度，讓光纖端剛好落在旋轉中心（3D 以 44 mm 高示意得 10.5 mm，6 軸型號確定後重算）'],
    ['F：拆掉角度模組時用的等高墊塊 95.5 mm', 'F：拆掉角度模組時用的等高墊塊，高度＝85 mm＋E（3D 示意 95.5 mm）'],
    ['壓電台本身就 44 mm 高，光纖端到不了旋轉中心', '壓電台（約 40–44 mm）加快換座與夾具頭就超過 50 mm，光纖端到不了旋轉中心'],
    ['輸出電壓給 E-727 畫圓', '輸出電壓給壓電驅動器畫圓'],
    ['可直接驅動 E-727 畫圓', '可直接驅動壓電驅動器畫圓'],
    ['接 E-727 的 Sub-D 15 線直接鎖在端子上', '接壓電驅動器的線直接鎖在端子上'],
    ['16 路類比輸入 2 MS/s、16 bit', '照片為 Mass Termination 版（參考圖），報價是螺絲端子版 781442-01；16 路類比輸入 2 MS/s、16 bit'],
    ['圖為 USB-6361（6363 外觀相同）', '圖為 USB-6361 Mass Termination 版（參考圖，6363 外觀相同）'],
    ['TW1550R5A2：1550', '照片為同系列 TN1310R5A2（參考圖）；TW1550R5A2：1550'],
    ['圖為上詮同系列耦合器（官網照片）', '圖為上詮同系列耦合器（官網照片，圖中為 1×4）'],
    ["IMG['67_Browave_PLC.jpg'],src:'波若威官網產品照片'", "IMG['67_Browave_PLC.jpg'],src:'波若威官網產品照片（圖為 2×N 模組，參考圖）'"],
    ['圖為 E53 系列控制器（芯明天官方商店）', '圖為 E53 系列單通道控制器（參考圖；XYZ 要 3 通道機型或 3 台）'],
    ['6.5X 變焦（0.7–4.5X）', '6.5X 變焦（0.7–4.5X；需另購延伸管，未計入報價）'],
    ['型錄只列伺服馬達（三菱 MR-J4、松下、台達）', '官網寫可搭配各品牌馬達，型錄範例為伺服（三菱 MR-J4、松下、台達）'],
    ['水平荷重 30 kg（官網）', '水平荷重 30 kg（導程 2、5 mm；官網）'],
    ["'Thorlabs PWA075',1,29530,29530,'D',IMG['22_PWA075.webp'],'隔絕地板振動。'", "'Thorlabs PWA075',1,29530,29530,'D',IMG['22_PWA075.webp'],'隔絕地板振動。一個料號就是 4 支，合計負載有下限，要和麵包板＋設備重量確認（較輕可改 PWA074）。'"],
  ]) code = once(code, a, b);
  // 報價清單的元件照片（63 張、約 9 MB base64）只給側欄 <img> 用，不是 3D 貼圖：拆成 platform_img/ 下的檔案，
  // 嵌入版從 9.5 MB 降到 1 MB 內，三個機台 iframe 不用各自解析 9 MB 字串（file:// 下 <img> 讀相對路徑沒問題）
  mkdirSync('dist/platform_img', { recursive: true });
  let nImg = 0;
  code = code.replace(/'([\w.+-]+\.(?:png|jpe?g|webp|gif))':'data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)'/g, (_, name, b64) => {
    writeFileSync(`dist/platform_img/${name}`, Buffer.from(b64, 'base64')); nImg++; return `'${name}':'platform_img/${name}'`;
  });
  if (!nImg) throw new Error('報價網頁的元件照片格式變了，找不到 IMG 內嵌圖');
  code += '\n' + readFileSync('src/platform-finish.js', 'utf8') + '\n' + EMBED_API;
  const r = await build({ stdin: { contents: code, resolveDir: '.', loader: 'js' }, bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none' });
  const js = r.outputFiles[0].text.replace(/<\/script>/gi, '<\\/script>');
  let html = src.replace(/<script type="importmap">[\s\S]*?<\/script>/, '');
  html = html.replace(m[0], () => `<script>${js}</script>`);
  html = must(html, '<html lang="zh-Hant">', '<html lang="zh-Hant" data-theme="dark">');
  html = must(html, '</style>', EMBED_CSS + '</style>');
  writeFileSync('dist/platform_embed.html', html);
  console.log(`platform embed  ${(html.length / 1024).toFixed(0)} KB（照片 ${nImg} 張拆到 platform_img/）`);
}

await buildPlatform();
const out = '光纖對PIC對位_計畫報告.html';
const r = await build({
  entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife',
  write: false, target: 'es2020', legalComments: 'none', loader: { '.html': 'text' },
});
const js = r.outputFiles[0].text.replace(/<\/script>/gi, '<\\/script>');
const css = readFileSync('src/style.css', 'utf8') + '\n' + readFileSync('src/progress-ui.css', 'utf8') + '\n' + readFileSync('src/edge-ui.css', 'utf8') + '\n' + readFileSync('src/array-ui.css', 'utf8') + '\n' + readFileSync('src/machine-ui.css', 'utf8');
const tpl = readFileSync('src/template.html', 'utf8');
const html = tpl.replace('/*CSS*/', () => css).replace('/*JS*/', () => js);
writeFileSync('dist/index.html', html);
writeFileSync(`dist/${out}`, html);
writeFileSync('dist/.nojekyll', '');
const notices = ['THIRD_PARTY_NOTICES.md', 'node_modules/three/LICENSE', 'node_modules/katex/LICENSE', 'node_modules/esbuild/LICENSE.md']
  .map((p) => `===== ${p} =====\n${readFileSync(p, 'utf8')}`).join('\n\n');
writeFileSync('dist/THIRD_PARTY_NOTICES.txt', notices);
console.log(`built ${out}  ${(html.length / 1024).toFixed(0)} KB`);
