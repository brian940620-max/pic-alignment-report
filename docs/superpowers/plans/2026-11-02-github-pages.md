# GitHub Pages 與跨裝置開發交付計畫

**Goal:** 完整公開這份互動報告，讓其他裝置可 clone、編輯、驗證及 push 後自動部署。

**Architecture:** 獨立儲存庫，不攜帶私人研究歷史。既有 Three.js／KaTeX／esbuild 架構保留；來源、圖片、硬體基底與數值驗證 fixture 都隨 repo 提供。GitHub Actions 建置 dist/ 並部署 Pages。

**Tech Stack:** Node.js 22、npm lockfile、Three.js 0.170.0、KaTeX、esbuild、GitHub Pages。

**Constraints:** Windows/macOS/Linux 同指令；不依賴上層目錄；真機未驗證；不加入私人計畫文件與訓練資料；使用者已授權公開網站與推送。

- [x] 收齊來源與必要素材，檢查公開內容與路徑。
- [x] 建置、預覽、自動重建與缺檔／數值核對。
- [x] 文件與 Pages workflow，三作業系統 CI。
- [x] 本機檢查及乾淨 clone 重建，瀏覽器驗證。
- [x] 建立公開 repo、push、Pages 部署、線上檢查。

**Review focus:** 圖片與 iframe 缺檔、GitHub 子路徑、平台專屬建置依賴、私密資訊、其他裝置推送與衝突處理。
