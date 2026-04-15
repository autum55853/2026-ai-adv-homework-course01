# 功能清單

## 功能完成狀態

| 功能區塊 | 狀態 |
|----------|------|
| 使用者認證（註冊/登入/個人資料） | ✅ 完成 |
| 商品列表與詳情（前台，公開） | ✅ 完成 |
| 購物車（訪客 + 登入雙模式） | ✅ 完成 |
| 訂單建立（Transaction，含庫存扣減） | ✅ 完成 |
| 訂單查詢（列表 + 詳情） | ✅ 完成 |
| 後台商品管理（CRUD） | ✅ 完成 |
| 後台訂單管理（查詢 + status 過濾） | ✅ 完成 |
| EJS 前台頁面 | ✅ 完成 |
| EJS 後台頁面 | ✅ 完成 |
| OpenAPI 文件產生 | ✅ 完成 |
| 綠界 ECPay 信用卡金流（`POST /api/orders/:id/ecpay-checkout` 產生表單、`POST /api/ecpay/notify` 驗證 CheckMacValue 並更新訂單狀態） | ✅ 完成 |

---

## 1. 使用者認證

### POST /api/auth/register — 註冊

**必填欄位：** `email`（符合 email 格式）、`password`（至少 6 字元）、`name`

**業務邏輯：**
1. 驗證 email 格式（`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`）
2. 驗證 password 長度 ≥ 6
3. 查詢 DB 確認 email 未被使用（`SELECT id FROM users WHERE email = ?`）
4. `bcrypt.hashSync(password, 10)` 產生雜湊（測試環境 saltRounds=1 加速）
5. 插入 users 表，role 固定為 `'user'`（無法自行指定 admin）
6. 產生 7 天 JWT，回傳 `{ user, token }`

**錯誤情境：**
- 缺少欄位 → 400 `VALIDATION_ERROR`
- email 格式錯誤 → 400 `VALIDATION_ERROR`
- password 少於 6 字元 → 400 `VALIDATION_ERROR`
- email 已存在 → 409 `CONFLICT`

---

### POST /api/auth/login — 登入

**必填欄位：** `email`、`password`

**業務邏輯：**
1. 查詢 users 表（以 email 查找）
2. `bcrypt.compareSync(password, user.password_hash)` 驗證密碼
3. 兩個步驟任一失敗均回傳相同訊息「Email 或密碼錯誤」（避免枚舉 email）
4. 成功回傳 7 天 JWT + user 資訊

**錯誤情境：**
- 缺少欄位 → 400 `VALIDATION_ERROR`
- email 不存在或密碼錯誤 → 401 `UNAUTHORIZED`

---

### GET /api/auth/profile — 個人資料

**認證：** JWT 必填

**回傳：** `{ id, email, name, role, created_at }`（不含 password_hash）

---

## 2. 商品（前台公開）

### GET /api/products — 商品列表

**查詢參數：**
| 參數 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| page | integer | 1 | 頁碼（最小值 1） |
| limit | integer | 10 | 每頁筆數（最小值 1，最大值 100） |

**業務邏輯：** 以 `created_at DESC` 排序，回傳商品陣列與 pagination 物件（`total`、`page`、`limit`、`totalPages`）。

**回傳範例：**
```json
{
  "data": {
    "products": [ { "id": "...", "name": "粉色玫瑰花束", "price": 1680, "stock": 30, ... } ],
    "pagination": { "total": 8, "page": 1, "limit": 10, "totalPages": 1 }
  },
  "error": null,
  "message": "成功"
}
```

---

### GET /api/products/:id — 商品詳情

**錯誤情境：** id 不存在 → 404 `NOT_FOUND`

---

## 3. 購物車（雙模式認證）

購物車支援**訪客**（`X-Session-Id` header）與**登入用戶**（`Authorization: Bearer` JWT）兩種身份。所有端點使用 `dualAuth` middleware，兩種模式行為一致，資料以 `session_id` 或 `user_id` 隔離。

> **重要**：訪客購物車與登入用戶購物車是獨立的，登入後不會自動合併訪客購物車。

### POST /api/cart — 加入商品

**必填欄位：** `productId`（UUID 字串）、`quantity`（正整數，預設 1）

**業務邏輯：**
1. 驗證 productId 存在
2. 查詢購物車中是否已有此商品（以 `product_id + owner` 查詢）
3. **若已存在**：計算新數量（現有數量 + 傳入數量），確認不超過庫存後更新
4. **若不存在**：確認傳入數量不超過庫存後新增

庫存檢查時機：在「計算新數量 > 庫存」時才拒絕，允許分次加入直到接近庫存上限。

**錯誤情境：**
- 缺少 productId → 400 `VALIDATION_ERROR`
- quantity 非正整數 → 400 `VALIDATION_ERROR`
- 商品不存在 → 404 `NOT_FOUND`
- 加入後總數量超過庫存 → 400 `STOCK_INSUFFICIENT`
- 無認證資訊（無 JWT 也無 X-Session-Id）→ 401 `UNAUTHORIZED`

---

### GET /api/cart — 查看購物車

**回傳：** `{ items, total }`
- `items`：每筆含 `id`、`product_id`、`quantity`、`product`（巢狀物件含 `name`、`price`、`stock`、`image_url`）
- `total`：所有品項的 `price × quantity` 加總

---

### PATCH /api/cart/:itemId — 更新數量

**必填欄位：** `quantity`（正整數）

**業務邏輯：** 以傳入數量**覆蓋**（非累加）現有數量，確認不超過庫存後更新。

**錯誤情境：**
- quantity 非正整數 → 400 `VALIDATION_ERROR`
- 項目不存在或不屬於此 owner → 404 `NOT_FOUND`
- 數量超過庫存 → 400 `STOCK_INSUFFICIENT`

---

### DELETE /api/cart/:itemId — 刪除項目

以 `id AND owner` 雙條件查詢，確認項目屬於此 owner 後刪除。

---

## 4. 訂單

### POST /api/orders — 建立訂單

**認證：** JWT 必填（訪客無法下單）

**必填欄位：** `recipientName`、`recipientEmail`（email 格式）、`recipientAddress`

**業務邏輯（Transaction）：**

訂單建立是整個系統最複雜的操作，以 `db.transaction()` 確保原子性：

```
1. 驗證收件人資訊（三欄位皆必填，email 需符合格式）
2. 讀取此 user_id 的所有購物車項目（JOIN products 取得庫存）
3. 購物車為空 → 400 CART_EMPTY（在 transaction 之外提前返回）
4. 逐一檢查各商品庫存（item.quantity > product.stock）
   → 若有不足，回傳不足商品名稱清單 → 400 STOCK_INSUFFICIENT
5. 計算訂單總金額（Σ price × quantity）
6. 進入 db.transaction()：
   a. INSERT INTO orders（id、order_no、user_id、收件人資訊、total_amount）
   b. 對每個購物車項目：
      - INSERT INTO order_items（快照 product_name 與 product_price）
      - UPDATE products SET stock = stock - quantity（扣減庫存）
   c. DELETE FROM cart_items WHERE user_id = ?（清空購物車）
7. 回傳訂單資訊（含 items 列表）
```

> **快照機制**：`product_name` 與 `product_price` 在插入 order_items 時從購物車資料取得，後續修改商品不影響已成立的訂單。

**訂單編號格式：** `ORD-YYYYMMDD-XXXXX`（XXXXX 為 UUID v4 前 5 碼轉大寫）

---

### GET /api/orders — 訂單列表

**認證：** JWT 必填

**回傳：** 以 `created_at DESC` 排序的訂單列表，每筆含 `id`、`order_no`、`total_amount`、`status`、`created_at`（不含 items）。

---

### GET /api/orders/:id — 訂單詳情

**認證：** JWT 必填

**業務邏輯：** `WHERE id = ? AND user_id = ?` 雙條件，用戶只能查看自己的訂單。回傳完整訂單資訊含 `items` 陣列（含 `product_id`、`product_name`、`product_price`、`quantity`）。

---

### POST /api/orders/:id/ecpay-checkout — 產生 ECPay 付款表單參數

**認證：** JWT 必填

**業務邏輯：**
1. 以 `id AND user_id` 雙條件查詢訂單（限本人）
2. 確認 `status === 'pending'`
3. 組合 ECPay AIO Checkout V5 參數（`ChoosePayment: Credit`、`EncryptType: 1`）並計算 CheckMacValue
4. 回傳 `{ actionUrl, params }`；前端動態建立 `<form>` 並 submit 至 `actionUrl`

**錯誤情境：**
- 訂單不存在或非本人 → 404 `NOT_FOUND`
- 訂單 status 非 pending → 400 `INVALID_STATUS`

---

### POST /api/ecpay/notify — ECPay server-to-server 回呼

**認證：** 無（公開端點；以 CheckMacValue 驗證來源）

**業務邏輯：**
1. 以相同邏輯重算 CheckMacValue，經 `crypto.timingSafeEqual` 比對；失敗回傳 `0|CheckMacValue Error`
2. 以 `REPLACE(order_no, '-', '') = ?` 查詢訂單（ECPay 端不接受 `-`）
3. 非 pending 訂單視為重送，直接回 `1|OK`（冪等）
4. `RtnCode === 1` → `status = 'paid'`；否則 `failed`，同時寫入 `ecpay_trade_no`
5. 回傳純文字 `1|OK`（ECPay 要求）

---

## 5. 後台商品管理（需 admin 角色）

### GET /api/admin/products — 後台商品列表

與前台 `GET /api/products` 邏輯相同，支援 `page`/`limit` 分頁，但需 admin 認證。

---

### POST /api/admin/products — 新增商品

**必填欄位：** `name`（非空字串）、`price`（正整數）、`stock`（非負整數）

**選填欄位：** `description`、`image_url`

**業務邏輯：** 插入後立即查詢並回傳完整商品資料（含 `created_at`、`updated_at`）。

---

### PUT /api/admin/products/:id — 更新商品

**業務邏輯：** 部分更新（merge patch 語意）：只有傳入的欄位會被更新，未傳入的欄位保留原值。更新時手動更新 `updated_at = datetime('now')`。

**驗證：**
- `name` 傳入但為空字串 → 400 `VALIDATION_ERROR`
- `price` 傳入但非正整數 → 400 `VALIDATION_ERROR`
- `stock` 傳入但為負數 → 400 `VALIDATION_ERROR`

---

### DELETE /api/admin/products/:id — 刪除商品

**業務邏輯：** 刪除前先確認是否存在 `status = 'pending'` 的訂單引用此商品（透過 `order_items JOIN orders`）。若有則拒絕刪除，避免刪除後無法追蹤未完成訂單的商品資訊。

**錯誤情境：**
- 商品不存在 → 404 `NOT_FOUND`
- 商品有 pending 訂單 → 409 `CONFLICT`

---

## 6. 後台訂單管理（需 admin 角色）

### GET /api/admin/orders — 後台訂單列表

**查詢參數：**
| 參數 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| page | integer | 1 | 頁碼 |
| limit | integer | 10 | 每頁筆數（最大 100） |
| status | string | 無（全部） | 過濾訂單狀態：`pending`、`paid`、`failed` |

**業務邏輯：** `status` 參數需在白名單 `['pending', 'paid', 'failed']` 中才生效，不在白名單的值視同未傳入（查詢全部）。

**回傳：** 含完整訂單欄位（含 `user_id`、`recipient_name`、`recipient_email`），以 `created_at DESC` 排序。

---

### GET /api/admin/orders/:id — 後台訂單詳情

**回傳：** 訂單完整欄位 + `items` 陣列 + `user` 物件（`{ name, email }`，用戶已刪除則為 `null`）。

> 與前台訂單詳情的差異：不限制 `user_id`（可查任意用戶的訂單），並額外帶出下單用戶資訊。
