# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用指令

```bash
# 安裝相依套件
npm install

# 啟動正式環境伺服器（會先建置 CSS）
npm start

# 開發模式：在兩個終端機分別執行
npm run dev:server
npm run dev:css

# 執行所有測試（必須循序執行）
npm test

# 執行單一測試檔案
npx vitest run tests/auth.test.js

# 產生 OpenAPI 規格文件
npm run openapi
```

## 環境設定

將 `.env.example` 複製為 `.env` 並設定 `JWT_SECRET`。未設定時伺服器會拒絕啟動。

預設種子管理員帳號：`admin@hexschool.com` / `12345678`

## 架構說明

**技術棧：** Express + EJS 模板引擎 + SQLite (better-sqlite3) + Tailwind CSS

**進入點：**
- `server.js` — 啟動 HTTP 伺服器，需要 `JWT_SECRET`
- `app.js` — Express 應用程式設定、路由掛載、404 與錯誤處理
- `src/database.js` — 開啟 `database.sqlite`，執行 `CREATE TABLE IF NOT EXISTS`，並在首次執行時植入管理員與商品資料

**路由架構：**
- `/api/auth/*` — 註冊、登入、個人資料
- `/api/products/*` — 公開商品列表與詳情
- `/api/cart/*` — 購物車 CRUD（雙重驗證，見下方）
- `/api/orders/*` — 使用者建立訂單與查詢
- `/api/admin/products/*` — 管理員商品管理（需要 admin 角色）
- `/api/admin/orders/*` — 管理員訂單管理（需要 admin 角色）
- `/` — EJS 頁面路由（`src/routes/pageRoutes.js`）

**驗證機制：**
- `authMiddleware` — 驗證 `Authorization: Bearer <token>` JWT，成功後附加 `req.user`
- `adminMiddleware` — 繼承 authMiddleware，拒絕非 admin 角色
- 購物車路由使用 `dualAuth`：優先嘗試 JWT，不存在時退而使用 `X-Session-Id` header（訪客購物車）。兩種方式都會產生 owner 身份用於限定 DB 查詢範圍

**API 回應格式（所有端點統一）：**
```json
{ "data": ..., "error": "ERROR_CODE_OR_NULL", "message": "人類可讀訊息" }
```

**視圖（Views）：**
- 兩種 layout：`views/layouts/front.ejs`（前台）與 `views/layouts/admin.ejs`（後台）
- 頁面將自身內容渲染為字串 `body`，再由 layout 透過 EJS 嵌入

**測試：**
- 位於 `tests/`，使用 Vitest + Supertest 對真實 SQLite DB 進行測試
- 測試檔案必須循序執行（非平行），順序定義於 `vitest.config.js`
- `tests/setup.js` 提供 `getAdminToken()` 與 `registerUser()` 輔助函式

**CSS：**
- 來源：`public/css/input.css`（Tailwind 指令）
- 輸出：`public/css/output.css`（已加入 .gitignore，需在建置或開發時產生）
