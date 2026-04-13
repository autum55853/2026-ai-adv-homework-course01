# 測試規範與指南

## 測試環境

- **框架**：Vitest 2 + Supertest 7
- **資料庫**：與開發共用同一個 `database.sqlite`（非獨立測試 DB）
- **執行方式**：循序執行（`fileParallelism: false`），測試檔案間有資料依賴關係

> **重要**：執行測試前不會重置資料庫。若需要乾淨的環境，手動刪除 `database.sqlite` 再執行測試，伺服器啟動時會自動重建。

---

## 測試檔案說明

| 檔案 | 測試對象 | 依賴關係 |
|------|----------|----------|
| `tests/auth.test.js` | `POST /api/auth/register`、`POST /api/auth/login`、`GET /api/auth/profile` | 無（最先執行） |
| `tests/products.test.js` | `GET /api/products`、`GET /api/products/:id` | 依賴種子商品資料（`database.js` 已植入） |
| `tests/cart.test.js` | `GET/POST/PATCH/DELETE /api/cart` | 依賴種子商品資料；測試訪客與登入兩種模式 |
| `tests/orders.test.js` | `POST/GET /api/orders`、`GET /api/orders/:id` | 依賴種子商品資料；需先建立 cart item |
| `tests/adminProducts.test.js` | `GET/POST/PUT/DELETE /api/admin/products` | 依賴種子管理員帳號；會建立並刪除測試商品 |
| `tests/adminOrders.test.js` | `GET /api/admin/orders`、`GET /api/admin/orders/:id` | 依賴前序測試建立的訂單資料，或自行在 `beforeAll` 建立訂單 |

---

## 執行順序

`vitest.config.js` 定義固定執行順序，不可改變：

```
1. tests/auth.test.js
2. tests/products.test.js
3. tests/cart.test.js
4. tests/orders.test.js
5. tests/adminProducts.test.js
6. tests/adminOrders.test.js
```

順序原因：
- `cart.test.js` 的 `beforeAll` 需要取得商品 ID（依賴 products 種子資料）
- `orders.test.js` 的 `beforeAll` 需要先將商品加入購物車（依賴購物車功能）
- `adminOrders.test.js` 的 `beforeAll` 需要建立訂單（依賴完整的購物車 + 訂單流程）

---

## 輔助函式（tests/setup.js）

```js
const { app, request, getAdminToken, registerUser } = require('./setup');
```

### `getAdminToken()`
登入種子管理員帳號（`admin@hexschool.com` / `12345678`），回傳 JWT token 字串。

```js
const adminToken = await getAdminToken();
// 用法：.set('Authorization', `Bearer ${adminToken}`)
```

### `registerUser(overrides = {})`
動態建立測試用戶，避免 email 衝突。回傳 `{ token, user }`。

```js
const { token, user } = await registerUser();
// 或自訂 email：
const { token } = await registerUser({ email: 'custom@example.com', password: 'mypass', name: '自訂名稱' });
```

內部使用 `Date.now() + Math.random()` 產生唯一 email，適合在同一測試執行中多次呼叫。

---

## 執行指令

```bash
# 執行所有測試
npm test

# 執行單一測試檔案
npx vitest run tests/auth.test.js

# 執行含有特定關鍵字的測試
npx vitest run --testNamePattern="should create an order"

# 監聽模式（開發中使用，但注意 fileParallelism: false 仍有效）
npx vitest
```

---

## 撰寫新測試的步驟

### 1. 確定測試放置位置

- 若是現有功能的測試 → 加入對應的現有測試檔案
- 若是新功能 → 在 `tests/` 新建測試檔案，並在 `vitest.config.js` 的 `sequence.files` 陣列中加入（注意執行順序）

### 2. 測試檔案範本

```js
const { app, request, getAdminToken, registerUser } = require('./setup');

describe('新功能 API', () => {
  let token;
  let resourceId;

  beforeAll(async () => {
    // 準備測試前置條件（取得 token、建立測試資料等）
    const { token: t } = await registerUser();
    token = t;
  });

  it('should 正向測試描述', async () => {
    const res = await request(app)
      .post('/api/new-endpoint')
      .set('Authorization', `Bearer ${token}`)
      .send({ field: 'value' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error', null);  // 成功時 error 必須是 null
    expect(res.body.data).toHaveProperty('id');

    resourceId = res.body.data.id;  // 儲存供後續測試使用
  });

  it('should 負向測試描述（缺少必填欄位）', async () => {
    const res = await request(app)
      .post('/api/new-endpoint')
      .set('Authorization', `Bearer ${token}`)
      .send({});  // 缺少必填欄位

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('data', null);  // 失敗時 data 必須是 null
    expect(res.body.error).not.toBeNull();          // 失敗時 error 不可為 null
  });
});
```

### 3. 常見驗證模式

**驗證成功回應：**
```js
expect(res.status).toBe(200);
expect(res.body).toHaveProperty('data');
expect(res.body).toHaveProperty('error', null);
expect(res.body).toHaveProperty('message');
```

**驗證失敗回應：**
```js
expect(res.status).toBe(400); // 或 401, 403, 404, 409
expect(res.body).toHaveProperty('data', null);
expect(res.body.error).not.toBeNull();
```

---

## 常見陷阱

### 陷阱 1：測試間資料污染

測試共用同一個 DB，且不會在每個測試前後重置。若 `adminProducts.test.js` 建立了一個商品並刪除，後面的測試不應假設該商品仍存在。

**解法**：在 `beforeAll` 中動態建立所需資料，而非假設特定資料已存在。

### 陷阱 2：硬編碼 ID

不可在測試中硬編碼 UUID，因為每次執行資料庫重建後 ID 都不同。

```js
// ❌ 錯誤：硬編碼 ID
const res = await request(app).get('/api/products/abc-123-fixed-id');

// ✅ 正確：動態取得
const listRes = await request(app).get('/api/products');
const productId = listRes.body.data.products[0].id;
const res = await request(app).get(`/api/products/${productId}`);
```

### 陷阱 3：測試順序依賴

`orders.test.js` 的 `beforeAll` 必須先加購物車才能建立訂單，因為建立訂單後購物車會被清空。若改變執行順序，`beforeAll` 中的購物車狀態可能不符預期。

### 陷阱 4：bcrypt 效能

在 `NODE_ENV=test` 時，`src/database.js` 的 `seedAdminUser()` 使用 `saltRounds=1`。測試中透過 `registerUser()` 建立的用戶在 `authRoutes.js` 中使用 `saltRounds=10`（因為 `registerUser` 走的是 HTTP API，不直接呼叫 `database.js`）。若測試太慢，可檢查是否有大量的 `registerUser()` 呼叫。

### 陷阱 5：購物車訪客模式的 session_id 衝突

`cart.test.js` 使用 `'test-session-' + Date.now()` 作為 session_id，每次執行測試時的值不同，不會與其他測試資料衝突。若新增購物車測試，務必使用唯一的 session_id。
