# 更新日誌

所有版本的重要變更都會記錄在此文件中。

格式參考：[Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)

---

## [1.1.0] - 2026-04-15

### 新增
- 綠界 ECPay 信用卡金流整合（AIO Checkout V5，`ChoosePayment: Credit`）
  - `POST /api/orders/:id/ecpay-checkout`：產生表單參數與 CheckMacValue，回傳 `{ actionUrl, params }` 供前端 submit
  - `POST /api/ecpay/notify`：server-to-server 回呼端點，以 `crypto.timingSafeEqual` 驗證 CheckMacValue，冪等更新訂單狀態
  - `src/utils/ecpay.js`：共用 CheckMacValue 產生／驗證邏輯（.NET 風格 URL encode + SHA256）
  - 訂單詳情頁（GET/POST 皆支援）可接收 ECPay OrderResultURL 的 POST 回跳
- `orders.ecpay_trade_no` 欄位（`ALTER TABLE` 冪等遷移），回呼成功時寫入

### 變更
- 訂單詳情頁的「模擬付款成功／失敗」按鈕替換為單一「信用卡付款」按鈕

### 移除
- `PATCH /api/orders/:id/pay` 模擬付款 API 與前端對應邏輯

---

## [1.0.0] - 2026-04-13

### 新增
- 使用者認證系統（註冊、登入、個人資料），使用 JWT HS256，有效期 7 天
- 前台商品列表與詳情 API（公開，支援分頁）
- 購物車 API（訪客 X-Session-Id 模式 + JWT 登入模式雙重認證）
- 訂單建立 API（SQLite Transaction：庫存扣減、order_items 快照、購物車清空）
- 訂單查詢 API（列表 + 詳情，限自己的訂單）
- 模擬付款 API（success/fail，僅 pending 訂單可操作）
- 後台商品管理 CRUD（新增、列表分頁、部分更新、刪除含 pending 訂單保護）
- 後台訂單管理（列表含 status 過濾、詳情含下單用戶資訊）
- EJS 前台頁面（首頁、商品詳情、購物車、結帳、登入、訂單列表、訂單詳情）
- EJS 後台頁面（商品管理、訂單管理）
- Tailwind CSS 4 前端樣式
- Vitest + Supertest 測試套件（6 個測試檔案，循序執行）
- swagger-jsdoc OpenAPI 3.0.3 文件產生工具
- SQLite 自動初始化（首次啟動建立 5 張資料表 + 種子資料）
