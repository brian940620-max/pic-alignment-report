# 發佈與跨裝置驗證（2026-11-02）

網站：https://brian940620-max.github.io/pic-alignment-report/

功能版本：`7120ae4`。對應 [GitHub Actions 完整執行](https://github.com/brian940620-max/pic-alignment-report/actions/runs/41391669626)。

| 項目 | 結果 |
| --- | --- |
| GitHub CI：Windows / macOS / Linux、Node 22 | 三組 npm ci + npm run check 全部成功 |
| Pages build / deploy | 成功；HTTPS 啟用 |
| 從 GitHub 全新 clone，不依賴原研究專案 | npm ci + npm run check 成功，git working tree 維持乾淨 |
| 套件檢查 | npm 回報 0 個已知漏洞（查核當時） |
| FA8 數值核對 | 200 姿態 × 8 通道；最大誤差 1.30e-14，PASS |
| 資源完整性 | 8 個報告靜態引用、63 張硬體照片、11.7 MiB 發佈目錄，PASS |
| 本機開發 | 來源變動觸發重建、瀏覽器自動重新整理成功 |
| 正式網站 Chrome 1600×900 | 27 頁全數建立，無載入失敗、相關 error / warn |
| 正式網站 3D 硬體 | 三個 iframe 全數就緒，已載入照片無缺圖 |
| 正式網站互動 | FA 滾轉 0.1° → 最差相對標稱損耗 -1.37 dB，與本機一致 |

公開來源經已知 token、私鑰、聯絡信箱與原電腦路徑的針對性檢查；移除硬體來源中的聯絡信箱與電話，保留官方圖源與規格連結。這不是完整資安稽核。

尚未在使用者的其他實體裝置上執行；三個作業系統的雲端建置通過，不代表所有瀏覽器、GPU 與字型都已測過。固定比例舞台以桌機／平板橫向為主；手機僅等比縮小。研究數字仍為模擬，尚未進行真機驗證。
