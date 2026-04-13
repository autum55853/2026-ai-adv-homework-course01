# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

花卉電商網站後端 — Express.js + EJS 模板引擎 + SQLite (better-sqlite3) + Tailwind CSS。提供前台購物流程（商品瀏覽、購物車、結帳、訂單查詢）與後台管理功能（商品管理、訂單管理）。

## 常用指令

```bash
npm install            # 安裝相依套件
npm start              # 正式環境啟動（先建置 CSS 再啟動伺服器）
npm run dev:server     # 開發：僅啟動伺服器
npm run dev:css        # 開發：監聽 CSS 變更（需另開終端機）
npm test               # 執行全部測試（循序）
npx vitest run tests/auth.test.js   # 執行單一測試檔案
npm run openapi        # 產生 openapi.json 規格文件
```

## 關鍵規則

- **統一回應格式**：所有 API 回應必須遵循 `{ data, error, message }` 結構，`error` 在成功時為 `null`，失敗時為全大寫錯誤碼字串（如 `VALIDATION_ERROR`、`NOT_FOUND`）
- **購物車雙模式認證**：購物車 API 優先使用 JWT（`Authorization: Bearer`），不存在時退回 `X-Session-Id` header（訪客模式）；兩種方式分別以 `user_id` 或 `session_id` 作為資料隔離鍵
- **測試共用同一個 SQLite DB**：測試不使用獨立資料庫，所有測試共享 `database.sqlite`，且必須循序執行（`fileParallelism: false`），新增測試須考量前序測試留下的資料狀態
- **訂單建立使用 Transaction**：訂單建立、order_items 插入、庫存扣減、購物車清空四個操作包在同一個 `db.transaction()` 中，確保原子性
- **功能開發使用計畫文件**：開發新功能前在 `docs/plans/` 建立計畫文件，完成後移至 `docs/plans/archive/`

## 詳細文件

- [docs/README.md](./docs/README.md) — 項目介紹與快速開始
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 架構、目錄結構、資料流、DB Schema
- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) — 開發規範、命名規則、環境變數
- [docs/FEATURES.md](./docs/FEATURES.md) — 功能列表、行為描述、錯誤碼
- [docs/TESTING.md](./docs/TESTING.md) — 測試規範、執行順序、撰寫指南
- [docs/CHANGELOG.md](./docs/CHANGELOG.md) — 更新日誌
