# 花卉電商網站

以 Node.js + Express 構建的全端電商後端，涵蓋前台購物流程與後台管理，搭配 EJS 伺服器端渲染頁面。

## 技術棧

| 類別 | 技術 |
|------|------|
| 後端框架 | Express.js ~4.16 |
| 模板引擎 | EJS 5 |
| 資料庫 | SQLite（better-sqlite3 12） |
| 認證 | JWT（jsonwebtoken 9，HS256，7天有效期） |
| 加密 | bcrypt 6 |
| CSS | Tailwind CSS 4（CLI 模式） |
| 測試 | Vitest 2 + Supertest 7 |
| API 文件 | swagger-jsdoc 6（OpenAPI 3.0.3） |

## 快速開始

```bash
# 1. 安裝相依套件
npm install

# 2. 建立環境變數檔案
cp .env.example .env
# 編輯 .env，至少設定 JWT_SECRET（任意字串皆可，例如：mysecretkey）

# 3. 啟動開發伺服器（需兩個終端機）
npm run dev:server   # 終端機 1：啟動 Express 伺服器，預設 port 3001
npm run dev:css      # 終端機 2：監聽 CSS 並自動重建

# 4. 開啟瀏覽器
# 前台首頁：http://localhost:3001/
# 後台商品：http://localhost:3001/admin/products
# 後台訂單：http://localhost:3001/admin/orders
```

> **注意**：首次啟動時 `src/database.js` 會自動建立 `database.sqlite`，並植入管理員帳號與 8 筆範例商品，無需手動初始化。

## 預設帳號

| 角色 | Email | 密碼 |
|------|-------|------|
| 管理員 | admin@hexschool.com | 12345678 |

## 常用指令

| 指令 | 說明 |
|------|------|
| `npm start` | 建置 CSS 後啟動正式伺服器 |
| `npm run dev:server` | 啟動開發伺服器（不含 CSS 監聽） |
| `npm run dev:css` | 啟動 Tailwind CSS 監聽模式 |
| `npm test` | 執行全部測試（循序） |
| `npx vitest run tests/<file>` | 執行單一測試檔案 |
| `npm run openapi` | 從路由 JSDoc 產生 `openapi.json` |

## 文件索引

| 文件 | 內容 |
|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 目錄結構、啟動流程、API 路由總覽、DB Schema、認證機制 |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | 開發規範、命名規則、新增 API 步驟、環境變數說明 |
| [FEATURES.md](./FEATURES.md) | 功能區塊行為描述、業務邏輯、錯誤碼說明 |
| [TESTING.md](./TESTING.md) | 測試執行順序、撰寫規範、常見陷阱 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本更新日誌 |
