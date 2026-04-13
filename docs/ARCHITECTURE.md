# 架構說明

## 目錄結構

```
.
├── server.js                  # HTTP 伺服器進入點；檢查 JWT_SECRET 後呼叫 app.listen()
├── app.js                     # Express 應用程式設定：middleware 掛載、路由掛載、404/錯誤處理
├── generate-openapi.js        # 讀取 swagger-config.js，從路由 JSDoc 產生 openapi.json
├── swagger-config.js          # swagger-jsdoc 設定（定義 bearerAuth 與 sessionId 安全機制）
├── vitest.config.js           # Vitest 設定：禁用平行執行、定義測試檔案執行順序
├── .env.example               # 環境變數範本
├── database.sqlite            # SQLite 資料庫（首次啟動自動建立，加入 .gitignore）
│
├── src/
│   ├── database.js            # 開啟 DB、建立所有資料表、植入種子資料（admin + 8 筆商品）
│   ├── middleware/
│   │   ├── authMiddleware.js  # 驗證 JWT Bearer Token；成功後附加 req.user（userId, email, role）
│   │   ├── adminMiddleware.js # 檢查 req.user.role === 'admin'；須接在 authMiddleware 之後
│   │   ├── sessionMiddleware.js # 讀取 X-Session-Id header，附加至 req.sessionId
│   │   └── errorHandler.js   # Express 錯誤處理器（四參數）；500 固定回傳安全訊息，其他使用 SAFE_MESSAGES 對照表
│   └── routes/
│       ├── authRoutes.js      # POST /register、POST /login、GET /profile
│       ├── productRoutes.js   # GET /api/products（分頁）、GET /api/products/:id（公開，無需認證）
│       ├── cartRoutes.js      # GET/POST/PATCH/DELETE /api/cart（雙模式認證：JWT 或 X-Session-Id）
│       ├── orderRoutes.js     # POST/GET /api/orders、GET /api/orders/:id、PATCH /api/orders/:id/pay（需 JWT）
│       ├── adminProductRoutes.js # GET/POST /api/admin/products、PUT/DELETE /api/admin/products/:id（需 admin）
│       ├── adminOrderRoutes.js   # GET /api/admin/orders（可過濾 status）、GET /api/admin/orders/:id（需 admin）
│       └── pageRoutes.js      # 所有 EJS 頁面路由（前台 + 後台）
│
├── views/
│   ├── layouts/
│   │   ├── front.ejs          # 前台 Layout（引入 head、header、footer partials，渲染 body 變數）
│   │   └── admin.ejs          # 後台 Layout（引入 admin-header、admin-sidebar partials）
│   ├── partials/              # 共用片段（head、header、footer、admin-header、admin-sidebar、notification）
│   └── pages/                 # 各頁面 EJS（index、product-detail、cart、checkout、login、orders、order-detail、admin/products、admin/orders、404）
│
├── public/
│   ├── css/
│   │   ├── input.css          # Tailwind CSS 來源（@import "tailwindcss"）
│   │   └── output.css         # Tailwind 編譯輸出（.gitignore，執行時產生）
│   └── js/
│       ├── api.js             # 前端 API 請求封裝（fetch wrapper，自動附加 Authorization/X-Session-Id）
│       ├── auth.js            # 前端認證狀態管理（localStorage token 存取、登入狀態檢查）
│       ├── header-init.js     # 初始化 header 登入/登出狀態
│       ├── notification.js    # 全域通知（toast）元件
│       └── pages/             # 各頁面專屬 JS（index、product-detail、cart、checkout、login、orders、order-detail、admin-products、admin-orders）
│
└── tests/
    ├── setup.js               # 匯出 app、request（supertest）、getAdminToken()、registerUser() 輔助函式
    ├── auth.test.js
    ├── products.test.js
    ├── cart.test.js
    ├── orders.test.js
    ├── adminProducts.test.js
    └── adminOrders.test.js
```

---

## 啟動流程

```
node server.js
  │
  ├─ require('dotenv').config()          ← 載入 .env
  ├─ 檢查 process.env.JWT_SECRET         ← 未設定則 process.exit(1)
  │
  └─ require('./app')
       │
       ├─ require('./src/database')      ← 開啟 database.sqlite
       │    ├─ CREATE TABLE IF NOT EXISTS（5 張表）
       │    ├─ seedAdminUser()           ← 若不存在則新增 admin 帳號
       │    └─ seedProducts()            ← 若 products 表為空則插入 8 筆商品
       │
       ├─ 掛載 global middleware
       │    ├─ cors()
       │    ├─ express.json()
       │    ├─ express.urlencoded()
       │    └─ sessionMiddleware         ← 讀取 X-Session-Id → req.sessionId
       │
       ├─ 掛載 API 路由（/api/*）
       ├─ 掛載 Page 路由（/）
       ├─ 掛載 404 handler
       └─ 掛載 errorHandler（四參數）

app.listen(PORT || 3001)
```

---

## API 路由總覽

| 方法 | 路徑 | 檔案 | 認證 | 說明 |
|------|------|------|------|------|
| POST | /api/auth/register | authRoutes.js | 無 | 註冊新帳號，回傳 user + JWT |
| POST | /api/auth/login | authRoutes.js | 無 | 登入，回傳 user + JWT |
| GET | /api/auth/profile | authRoutes.js | JWT | 取得自己的個人資料 |
| GET | /api/products | productRoutes.js | 無 | 商品列表（分頁：page、limit） |
| GET | /api/products/:id | productRoutes.js | 無 | 商品詳情 |
| GET | /api/cart | cartRoutes.js | JWT 或 Session | 查看購物車（含商品資訊與合計） |
| POST | /api/cart | cartRoutes.js | JWT 或 Session | 加入商品（相同商品累加數量） |
| PATCH | /api/cart/:itemId | cartRoutes.js | JWT 或 Session | 更新購物車項目數量（覆蓋） |
| DELETE | /api/cart/:itemId | cartRoutes.js | JWT 或 Session | 刪除購物車項目 |
| POST | /api/orders | orderRoutes.js | JWT | 從購物車建立訂單（清空購物車、扣庫存） |
| GET | /api/orders | orderRoutes.js | JWT | 自己的訂單列表 |
| GET | /api/orders/:id | orderRoutes.js | JWT | 訂單詳情（含 order_items） |
| PATCH | /api/orders/:id/pay | orderRoutes.js | JWT | 模擬付款（action: success/fail） |
| GET | /api/admin/products | adminProductRoutes.js | JWT + admin | 後台商品列表（分頁） |
| POST | /api/admin/products | adminProductRoutes.js | JWT + admin | 新增商品 |
| PUT | /api/admin/products/:id | adminProductRoutes.js | JWT + admin | 更新商品（部分欄位也可） |
| DELETE | /api/admin/products/:id | adminProductRoutes.js | JWT + admin | 刪除商品（有 pending 訂單時拒絕） |
| GET | /api/admin/orders | adminOrderRoutes.js | JWT + admin | 後台訂單列表（可按 status 過濾） |
| GET | /api/admin/orders/:id | adminOrderRoutes.js | JWT + admin | 訂單詳情（含 items + 下單用戶資訊） |

---

## 統一 API 回應格式

**所有端點**（成功或失敗）均回傳以下結構：

```json
{
  "data": { ... } | null,
  "error": null | "ERROR_CODE",
  "message": "人類可讀訊息"
}
```

**錯誤碼一覽：**

| 錯誤碼 | HTTP 狀態 | 情境 |
|--------|-----------|------|
| `VALIDATION_ERROR` | 400 | 必填欄位缺失或格式錯誤 |
| `CART_EMPTY` | 400 | 建立訂單時購物車為空 |
| `STOCK_INSUFFICIENT` | 400 | 加入購物車或建立訂單時庫存不足 |
| `INVALID_STATUS` | 400 | 訂單已非 pending，無法付款 |
| `UNAUTHORIZED` | 401 | 未附帶 Token、Token 無效或過期 |
| `FORBIDDEN` | 403 | 已登入但非 admin 角色 |
| `NOT_FOUND` | 404 | 資源不存在 |
| `CONFLICT` | 409 | Email 已被註冊；或商品有 pending 訂單無法刪除 |
| `INTERNAL_ERROR` | 500 | 伺服器未預期錯誤（訊息固定為「伺服器內部錯誤」） |

---

## 認證與授權機制

### authMiddleware（一般 JWT 驗證）

1. 讀取 `Authorization` header，格式必須為 `Bearer <token>`
2. 以 `jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })` 驗證
3. 再查詢 DB 確認 user 存在（避免 token 有效但 user 已刪除）
4. 成功後掛載 `req.user = { userId, email, role }`

### adminMiddleware（角色檢查）

- 僅檢查 `req.user.role === 'admin'`，必須在 `authMiddleware` 之後使用
- 失敗回傳 403 `FORBIDDEN`

### cartRoutes 的 dualAuth（雙模式認證）

```
dualAuth 邏輯：
1. 有 Authorization header → 走 JWT 驗證
   - Token 無效 → 立即 401（不嘗試 Session）
   - Token 有效 → req.user 設定完成 → 以 user_id 隔離資料
2. 無 Authorization header，有 X-Session-Id header → req.sessionId 已由 sessionMiddleware 設定 → 以 session_id 隔離資料
3. 兩者皆無 → 401
```

> **關鍵**：有 Bearer header 但 token 無效時，**不會** fallback 到 Session，直接 401。

### JWT 參數

| 參數 | 值 |
|------|----|
| 演算法 | HS256 |
| 有效期 | 7 天（`expiresIn: '7d'`） |
| Payload | `{ userId, email, role }` |
| 密鑰來源 | 環境變數 `JWT_SECRET` |

---

## 資料庫 Schema

資料庫檔案位於專案根目錄 `database.sqlite`，啟動時自動建立（`CREATE TABLE IF NOT EXISTS`）。

### users 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| email | TEXT | UNIQUE NOT NULL | 登入用 email |
| password_hash | TEXT | NOT NULL | bcrypt 雜湊（正式環境 saltRounds=10，測試環境=1） |
| name | TEXT | NOT NULL | 顯示名稱 |
| role | TEXT | NOT NULL DEFAULT 'user'，CHECK IN ('user','admin') | 角色 |
| created_at | TEXT | NOT NULL DEFAULT datetime('now') | 建立時間（ISO 字串） |

### products 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| name | TEXT | NOT NULL | 商品名稱 |
| description | TEXT | — | 商品描述（可為 NULL） |
| price | INTEGER | NOT NULL, CHECK(price > 0) | 售價（整數，新台幣） |
| stock | INTEGER | NOT NULL DEFAULT 0, CHECK(stock >= 0) | 庫存數量 |
| image_url | TEXT | — | 圖片 URL（可為 NULL） |
| created_at | TEXT | NOT NULL DEFAULT datetime('now') | 建立時間 |
| updated_at | TEXT | NOT NULL DEFAULT datetime('now') | 最後更新時間（PUT 時手動更新） |

### cart_items 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| session_id | TEXT | — | 訪客購物車識別碼（與 user_id 擇一使用） |
| user_id | TEXT | FOREIGN KEY → users.id | 登入用戶購物車 |
| product_id | TEXT | NOT NULL, FOREIGN KEY → products.id | 商品 ID |
| quantity | INTEGER | NOT NULL DEFAULT 1, CHECK(quantity > 0) | 數量 |

> `session_id` 與 `user_id` 不可同時存在，由應用層邏輯控制（`dualAuth` 的 `getOwnerCondition()`）。

### orders 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| order_no | TEXT | UNIQUE NOT NULL | 訂單編號，格式：`ORD-YYYYMMDD-XXXXX`（5位大寫英數隨機） |
| user_id | TEXT | NOT NULL, FOREIGN KEY → users.id | 下單用戶 |
| recipient_name | TEXT | NOT NULL | 收件人姓名 |
| recipient_email | TEXT | NOT NULL | 收件人 Email |
| recipient_address | TEXT | NOT NULL | 收件地址 |
| total_amount | INTEGER | NOT NULL | 訂單總金額（下單時計算快照） |
| status | TEXT | NOT NULL DEFAULT 'pending', CHECK IN ('pending','paid','failed') | 訂單狀態 |
| created_at | TEXT | NOT NULL DEFAULT datetime('now') | 建立時間 |

### order_items 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| order_id | TEXT | NOT NULL, FOREIGN KEY → orders.id | 所屬訂單 |
| product_id | TEXT | NOT NULL | 商品 ID（無 FK 約束，允許商品被刪除後仍保留記錄） |
| product_name | TEXT | NOT NULL | 下單時的商品名稱快照 |
| product_price | INTEGER | NOT NULL | 下單時的商品售價快照 |
| quantity | INTEGER | NOT NULL | 購買數量 |

> `product_name` 與 `product_price` 為快照欄位，商品修改後不影響已成立的訂單記錄。

---

## 模擬付款流程

此專案沒有真實金流整合，付款以模擬 API 實現：

```
PATCH /api/orders/:id/pay
  body: { "action": "success" }  →  訂單狀態改為 "paid"
  body: { "action": "fail" }     →  訂單狀態改為 "failed"
```

限制：
- 只有 `status = 'pending'` 的訂單可以執行付款
- 只有訂單的擁有者可以操作（`WHERE id = ? AND user_id = ?`）
- 狀態一旦變更即無法還原（無 `pending` 回復機制）

`.env.example` 中的 `ECPAY_*` 變數為未來接入綠界金流預留，目前程式碼中未使用。
