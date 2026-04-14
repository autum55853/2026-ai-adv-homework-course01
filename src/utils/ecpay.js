const crypto = require('crypto');

/**
 * 將字串按照 ECPay 官方 CheckMacValue 規則進行 URL 編碼
 * 不編碼字元：- _ . ! * ( ) （與 encodeURIComponent 預設一致）
 * 空格：轉為 +（依官方文件範例 Apple+iphone+15）
 * 其他字元：標準百分號編碼
 */
function dotNetUrlEncode(str) {
  return encodeURIComponent(String(str)).replace(/%20/g, '+');
}

/**
 * 計算 ECPay CheckMacValue（SHA256）
 * 算法：參數字母排序 → 組合字串加上 HashKey/HashIV → URL encode → 小寫 → SHA256 → 大寫
 *
 * @param {Object} params - 不含 CheckMacValue 的參數物件
 * @param {string} hashKey
 * @param {string} hashIV
 * @returns {string} 大寫十六進位 CheckMacValue
 */
function buildCheckMacValue(params, hashKey, hashIV) {
  const sortedKeys = Object.keys(params).sort();
  const paramStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
  const raw = `HashKey=${hashKey}&${paramStr}&HashIV=${hashIV}`;
  const encoded = dotNetUrlEncode(raw).toLowerCase();
  return crypto.createHash('sha256').update(encoded).digest('hex').toUpperCase();
}

/**
 * 產生送往 ECPay 的表單參數（含 CheckMacValue）
 *
 * @param {Object} order - 訂單物件，包含 order_no、total_amount、items（商品陣列）
 * @param {string} merchantTradeNo - 已處理的商家訂單編號（英數字，max 20 碼）
 * @param {string} returnURL - server-to-server 付款通知 URL（ECPay ReturnURL）
 * @param {string} orderResultURL - 瀏覽器付款完成後跳轉 URL
 * @param {string} clientBackURL - 用戶取消付款時返回的 URL
 * @returns {{ actionUrl: string, params: Object }}
 */
function generateParams(order, merchantTradeNo, returnURL, orderResultURL, clientBackURL) {
  const merchantId = process.env.ECPAY_MERCHANT_ID;
  const hashKey = process.env.ECPAY_HASH_KEY;
  const hashIV = process.env.ECPAY_HASH_IV;
  const env = process.env.ECPAY_ENV || 'staging';

  const actionUrl = env === 'production'
    ? 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5'
    : 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5';

  // 台灣時間（UTC+8）格式：yyyy/MM/dd HH:mm:ss
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const pad = n => String(n).padStart(2, '0');
  const tradeDate = `${now.getUTCFullYear()}/${pad(now.getUTCMonth() + 1)}/${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;

  // 商品名稱（以 # 分隔）
  const itemName = (order.items && order.items.length > 0)
    ? order.items.map(i => `${i.product_name} x${i.quantity}`).join('#')
    : `Order ${merchantTradeNo}`;

  const params = {
    MerchantID: merchantId,
    MerchantTradeNo: merchantTradeNo,
    MerchantTradeDate: tradeDate,
    PaymentType: 'aio',
    TotalAmount: String(order.total_amount),
    TradeDesc: `Order ${merchantTradeNo}`,
    ItemName: itemName,
    ReturnURL: returnURL,
    ChoosePayment: 'Credit',
    OrderResultURL: orderResultURL,
    ClientBackURL: clientBackURL,
    EncryptType: '1',
  };

  const checkMacValue = buildCheckMacValue(params, hashKey, hashIV);

  return {
    actionUrl,
    params: { ...params, CheckMacValue: checkMacValue },
  };
}

/**
 * 驗證 ECPay 回呼的 CheckMacValue
 *
 * @param {Object} body - req.body（已解析的 urlencoded 物件）
 * @param {string} hashKey
 * @param {string} hashIV
 * @returns {boolean}
 */
function verifyCheckMac(body, hashKey, hashIV) {
  const receivedMac = body.CheckMacValue;
  if (!receivedMac) return false;

  const paramsWithout = { ...body };
  delete paramsWithout.CheckMacValue;

  const expected = buildCheckMacValue(paramsWithout, hashKey, hashIV);

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(receivedMac, 'utf8')
    );
  } catch {
    return false;
  }
}

module.exports = { generateParams, verifyCheckMac };
