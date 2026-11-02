# 矽光子光纖對位互動報告

[開啟公開網站](https://brian940620-max.github.io/pic-alignment-report/)

以子計畫二為主軸的研究簡報：模場、影像粗對位、靈敏度、光功率回授、六軸陣列與硬體平台。**內容為模擬與規劃，尚未進行真機驗證。**

這是網站的完整獨立開發專案。圖片、硬體模型基底、動畫軌跡與 FA8 驗證資料均已收齊；不需要原 Windows 電腦、MATLAB、Python 或整個私人研究專案。

## 在其他電腦開始

先安裝 Git 與 **Node.js 22 LTS（含 npm）**，用自己的 GitHub 帳號登入 GitHub Desktop 或 `gh auth login`。讀取公開 repo 不需登入；推送需要此 repo 的寫入權限。

```sh
git clone https://github.com/brian940620-max/pic-alignment-report.git
cd pic-alignment-report
npm ci
npm run dev
```

開啟終端顯示的 `http://127.0.0.1:4173/`。修改 `src/`、`assets/` 或 `source/` 後會自動重建並重新整理瀏覽器。Ctrl+C 停止。

Windows PowerShell 若擋住 npm.ps1，將 `npm` 改用 `npm.cmd`（例如 `npm.cmd ci`）；不用修改 PowerShell 安全設定。macOS 可用 `nvm install && nvm use` 讀取 `.nvmrc`；GitHub CI 會在 Windows、macOS、Linux 的 Node 22 各建置與核對一次。

## 日常修改與同步

每次換裝置，先提交／push 上一台的工作，這一台再 pull：

```sh
git pull --ff-only
npm ci
npm run dev
```

完成編輯後先停止 dev，執行：

```sh
npm run check
git status
git add src assets source scripts build.mjs check_fa8.mjs package.json package-lock.json README.md AGENTS.md .github
git commit -m "Update interactive report"
git push
```

只 stage 本次有意修改的檔案；新增其他必要檔案時也要明確加入。main 的 push 會自動跑三個作業系統檢查並更新公開網站。到 GitHub 的 **Actions → Verify and deploy report** 等待綠勾；失敗時網站保留上次成功版本，先看紅色步驟的完整錯誤。一般協作可先建分支、提 PR，通過檢查再 merge。

若 `git pull --ff-only` 拒絕，先 `git status`：提交或 stash 本機工作，再處理分支分歧；不要 force push 或用 reset 覆蓋另一台的修改。push 時驗證的是 GitHub 登入，不是網頁訪客權限。

## 編輯哪裡

| 位置 | 用途 |
| --- | --- |
| `src/main.js` | 章節、標題、順序與架構圖導覽 |
| `src/pages/` | 各頁內容與互動；2-1 第六頁為 `sp21_array.js` |
| `src/*css`、`src/template.html` | 樣式與 HTML 外框 |
| `assets/` | 報告圖片（需要提交，不再忽略） |
| `src/zrun.json` | 已匯出的模擬動畫軌跡 |
| `source/platform.html` | 3D 硬體模型可編輯原始基底（內含照片） |
| `src/platform-finish.js`、`build.mjs` | 硬體呈現與嵌入轉換；依賴字串吻合，修改基底後須重建 |
| `test/fixtures/fa8_golden.json` | 原 MATLAB 匯出比對值；不需 MATLAB 即可核對 JS 模型 |
| `dist/` | 產出的公開網站；自動生成、不提交、不直接修改 |

## 建置、離線與部署

```sh
npm run check
npm run preview
```

`check` 會建置、檢查資源完整性並核對 FA8 數值。`preview` 只提供現有 `dist/`，不自動重建。`npm run build` 會輸出 `dist/index.html`、中文檔名副本、`platform_embed.html`、圖片與第三方授權。發佈／離線搬移時需要**整個 dist 資料夾**，不能只複製一個 HTML。第一次 `npm ci` 需要網路，網站執行不依賴 CDN。

GitHub Pages 設為 **Settings → Pages → Source: GitHub Actions**，workflow 在 `.github/workflows/pages.yml`。僅將 dist 上傳為 Pages artifact；repo 的文件、測試及建置來源不會被當作靜態網站目錄，但因 repo 公開仍可直接在 GitHub 閱讀。Pages 的標準流程見 [GitHub 官方文件](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 操作與限制

上方分頁／底部圓點跳頁，← → 換頁，Esc 回架構圖，F 全螢幕。固定 1600×900 舞台等比縮放，建議電腦或平板橫向；手機可瀏覽但控制項較小。新裝置建置通過不等於該裝置的 WebGL／字型已驗證，請用其瀏覽器實際開啟一遍。

本站保留原版的封面日期與研究假設；公開發佈沒有新增實驗結果。全研究資料集、模型權重、私人計畫文件與 Git 歷史不在這個網站 repo；本 repo 能獨立開發網站，不能單憑它重新訓練相機模型。

第三方軟體與圖片權利見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。公開 repo 不等於為所有研究內容與廠商圖片授予開源授權。
