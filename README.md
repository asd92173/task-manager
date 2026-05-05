# 口語化任務板（Supabase 版）

這版已改成 Supabase 雲端登入與雲端資料儲存。

## 1) 建立 Supabase 專案

1. 到 Supabase 建立專案
2. 在 SQL Editor 貼上 `supabase/schema.sql` 全部內容並執行
3. 到 Project Settings -> API 複製：
   - Project URL
   - anon public key

## 2) 設定環境變數

複製 `.env.example` 成 `.env`，填入：

```bash
VITE_SUPABASE_URL=你的ProjectURL
VITE_SUPABASE_ANON_KEY=你的AnonKey
```

## 3) 啟動

```bash
npm install
npm run dev
```

## 管理員帳號

- 使用 `admin / admin` 會自動轉成 `admin@admin.com` 登入
- 你需要先在 Supabase Auth 建立這個帳號（email: `admin@admin.com`, password: `admin`）
- 首次登入後會在 `profiles` 建立角色，預設 `admin@admin.com` 會是 `admin`

## 部署

照原本 GitHub Pages 流程部署即可。
