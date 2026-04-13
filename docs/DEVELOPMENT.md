# 開發規範

## 模組系統

專案使用 **CommonJS**（`require` / `module.exports`），不使用 ES Modules（`import` / `export`）。

`vitest.config.js` 例外：使用 `import { defineConfig }` 語法，因為 Vitest 設定檔本身以 ES Module 解析。

---

## 命名規則

### API 請求 body 欄位

使用 **camelCase**：

```json
{
  "recipientName": "...",
  "recipientEmail": "...",
  "recipientAddress": "...",
  "productId": "...",
  "image_url": "..."
}
```

> 例外：`image_url` 因對應資料庫欄位，保留 snake_case。

### 資料庫欄位與 API 回應欄位

使用 **snake_case**，與 SQLite 欄位名稱一致：

```json
{
  "order_no": "ORD-20260101-ABCDE",
  "user_id": "...",
  "created_at": "2026-01-01T00:00:00"
}
```

### 路由檔案

使用 **camelCase + Routes 後綴**：`authRoutes.js`、`adminProductRoutes.js`

### Middleware 檔案

使用 **camelCase + Middleware 後綴**：`authMiddleware.js`、`adminMiddleware.js`

### 錯誤碼（error 欄位）

使用 **全大寫 SCREAMING_SNAKE_CASE**：`VALIDATION_ERROR`、`NOT_FOUND`、`STOCK_INSUFFICIENT`

---

## 環境變數

| 變數名稱 | 必要性 | 預設值 | 說明 |
|----------|--------|--------|------|
| `JWT_SECRET` | **必填** | 無（未設定則拒絕啟動） | JWT 簽名密鑰（HS256） |
| `PORT` | 選填 | `3001` | HTTP 伺服器監聽 port |
| `BASE_URL` | 選填 | — | 伺服器對外 URL（目前程式碼未直接使用） |
| `FRONTEND_URL` | 選填 | `http://localhost:3001` | CORS 允許來源 |
| `ADMIN_EMAIL` | 選填 | `admin@hexschool.com` | 種子管理員帳號 email |
| `ADMIN_PASSWORD` | 選填 | `12345678` | 種子管理員帳號密碼 |
| `NODE_ENV` | 選填 | — | 設為 `test` 時 bcrypt saltRounds 降為 1（加速測試） |
| `ECPAY_MERCHANT_ID` | 選填 | — | 綠界商店代號（預留，未實作） |
| `ECPAY_HASH_KEY` | 選填 | — | 綠界 HashKey（預留，未實作） |
| `ECPAY_HASH_IV` | 選填 | — | 綠界 HashIV（預留，未實作） |
| `ECPAY_ENV` | 選填 | — | 綠界環境：`staging` 或 `production`（預留，未實作） |

---

## 新增 API 端點的步驟

1. **在對應路由檔案新增 route handler**（`src/routes/`）：
   - 在 handler 上方加上 `@openapi` JSDoc 註解（參考現有路由格式）
   - 使用 `db.prepare(...).get()/all()/run()` 操作資料庫（better-sqlite3 為同步 API）
   - 成功回傳統一格式：`res.json({ data: ..., error: null, message: '...' })`
   - 失敗回傳統一格式：`res.status(xxx).json({ data: null, error: 'ERROR_CODE', message: '...' })`

2. **若需要認證**：在 `router.use()` 或單一 route 上掛載 `authMiddleware`（或 `adminMiddleware`）

3. **若需要雙模式認證（訪客 + 登入）**：使用 `cartRoutes.js` 中 `dualAuth` 模式，以 `getOwnerCondition(req)` 取得隔離鍵

4. **在 `app.js` 掛載新路由**（若是全新路由檔案）：
   ```js
   app.use('/api/new-feature', require('./src/routes/newFeatureRoutes'));
   ```

5. **更新 FEATURES.md** 記錄功能行為

---

## 新增 Middleware 的步驟

1. 在 `src/middleware/` 建立 `xxxMiddleware.js`
2. 匯出函式簽名為 `function xxxMiddleware(req, res, next) { ... }`
3. 錯誤處理 middleware（四參數）：`function handler(err, req, res, next) { ... }`
4. 在需要的路由檔案或 `app.js` 中 `require` 並使用

---

## 新增資料表的步驟

1. 在 `src/database.js` 的 `initializeDatabase()` 函式中 `db.exec()` 內新增 `CREATE TABLE IF NOT EXISTS` 語句
2. 若需要種子資料，在 `initializeDatabase()` 呼叫新的 seed 函式
3. **注意**：資料庫 schema 變更不會自動遷移現有的 `database.sqlite`，開發期間若修改現有表結構需手動刪除 `database.sqlite` 重新建立

---

## JSDoc OpenAPI 格式說明

每個路由 handler 前需加 JSDoc 讓 `npm run openapi` 可產生 API 文件。格式範例：

```js
/**
 * @openapi
 * /api/example:
 *   post:
 *     summary: 功能簡述
 *     tags: [TagName]
 *     security:
 *       - bearerAuth: []         # JWT 認證（任意用戶）
 *       - sessionId: []          # X-Session-Id（訪客模式）
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [field1]
 *             properties:
 *               field1:
 *                 type: string
 *               field2:
 *                 type: integer
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 message:
 *                   type: string
 *       400:
 *         description: 參數錯誤
 *       401:
 *         description: 未授權
 */
```

可用的 `tags` 值（與現有文件一致）：`Auth`、`Products`、`Cart`、`Orders`、`Admin Products`、`Admin Orders`

---

## 計畫歸檔流程

1. **開始開發新功能前**：在 `docs/plans/` 建立計畫文件，命名格式：`YYYY-MM-DD-<feature-name>.md`

2. **計畫文件結構：**
   ```markdown
   # 功能名稱

   ## User Story
   身為 [角色]，我想要 [功能]，以便 [目的]。

   ## Spec（規格）
   - API 端點設計
   - 資料模型變更
   - 業務邏輯說明

   ## Tasks（任務清單）
   - [ ] 任務 1
   - [ ] 任務 2
   - [x] 已完成任務
   ```

3. **功能完成後**：
   - 將計畫文件移至 `docs/plans/archive/`
   - 更新 `docs/FEATURES.md`（新增功能描述，更新完成狀態表）
   - 更新 `docs/CHANGELOG.md`（新增版本條目）
