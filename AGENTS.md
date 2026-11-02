# 互動報告開發

- 本儲存庫是網站的獨立、公開來源。不要加入私人計畫書、報價單、聯絡資料、金鑰、MATLAB 原始資料集或模型權重。
- 先讀 README.md；跨裝置只需 Git、Node.js 22 及 npm，不需要 MATLAB、Python 或原電腦的資料夾。
- 章節與頁面配置：src/main.js；各頁：src/pages/；樣式：src/*css；3D 硬體來源：source/platform.html；建置轉換：build.mjs。
- 修改來源檔，不要手改 dist/。保留模擬與實機、假設與量測的區別，不改數字以迎合視覺。
- 先 git pull --ff-only，再開發。提交前 npm run check；UI 更動須在瀏覽器檢查實際畫面與互動（固定 1600x900 舞台），不能只看 build。
- 目前其他分支／裝置可能也在改同頁；遇到衝突須讀取雙方改動，不覆蓋或 force push。
