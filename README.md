# 口語化任務板（React + Vite）

這是一個簡單版「像 Notion 一樣」的任務系統，重點是可用口語化方式輸入：

- `今天我要寫 PLC 程式，週五前完成`
- `明天處理報表，4/30 前完成`
- `下週三要交測試文件`

系統會自動解析：

- 任務內容
- 截止日期（今天、明天、後天、週幾、YYYY/MM/DD、MM/DD）

資料儲存在瀏覽器本地端（localStorage）。

## 本機啟動

```bash
npm install
npm run dev
```

## 發布到 GitHub Pages（公開網址）

專案已內建自動部署流程：`.github/workflows/deploy.yml`

1. 建立 GitHub Repo（建議 repo 名稱：`task-manager`）
2. 把這份專案推到 `main` 分支
3. 到 GitHub 專案設定：`Settings` → `Pages`
4. `Build and deployment` 的來源選 `GitHub Actions`
5. 之後每次推送到 `main`，都會自動發布

發布後網址通常是：

`https://<你的GitHub帳號>.github.io/<repo名稱>/`

## 功能重點

- 口語輸入自動解析
- 任務新增
- 任務狀態切換（進行中 / 已完成）
- 任務刪除
- 公開網址可直接使用（不需你本機常駐）
