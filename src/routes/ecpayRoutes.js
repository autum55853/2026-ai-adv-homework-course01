const express = require('express');
const db = require('../database');
const { verifyCheckMac } = require('../utils/ecpay');

const router = express.Router();

/**
 * @openapi
 * /api/ecpay/notify:
 *   post:
 *     summary: 接收綠界付款結果通知（server-to-server）
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               MerchantID:
 *                 type: string
 *               MerchantTradeNo:
 *                 type: string
 *               RtnCode:
 *                 type: string
 *               TradeNo:
 *                 type: string
 *               CheckMacValue:
 *                 type: string
 *     responses:
 *       200:
 *         description: 固定回應純文字 1|OK 或 0|Error
 */
router.post('/notify', (req, res) => {
  const hashKey = process.env.ECPAY_HASH_KEY;
  const hashIV = process.env.ECPAY_HASH_IV;

  // 驗證簽章
  if (!verifyCheckMac(req.body, hashKey, hashIV)) {
    return res.send('0|Error');
  }

  const { MerchantTradeNo, RtnCode, TradeNo } = req.body;

  // 由 MerchantTradeNo（去連字號）反查訂單
  const order = db.prepare(
    `SELECT * FROM orders WHERE REPLACE(order_no, '-', '') = ?`
  ).get(MerchantTradeNo);

  if (!order) {
    return res.send('0|Error');
  }

  // 冪等保護：非 pending 訂單直接回應成功，避免重複處理
  if (order.status !== 'pending') {
    return res.send('1|OK');
  }

  if (RtnCode === '1') {
    db.prepare(
      `UPDATE orders SET status = 'paid', ecpay_trade_no = ? WHERE id = ?`
    ).run(TradeNo || null, order.id);
  } else {
    db.prepare(
      `UPDATE orders SET status = 'failed' WHERE id = ?`
    ).run(order.id);
  }

  res.send('1|OK');
});

module.exports = router;
