import { Router, Request, Response } from "express";
import { Order } from "../models/Order";
import { Cart } from "../models/Cart";
import { verifyHmac } from "../services/paymob";

const router = Router();

// POST /api/payments/paymob/webhook  — Paymob transaction callback (PUBLIC).
// Not behind requireAuth: Paymob is a server, not a logged-in user. Authenticity
// is established by verifying the HMAC signature instead.
router.post("/paymob/webhook", async (req: Request, res: Response): Promise<void> => {
  try {
    const receivedHmac = String(req.query.hmac ?? "");
    const payload = req.body as { type?: string; obj?: Record<string, unknown> };
    const obj = payload.obj;

    if (!obj || !verifyHmac(obj, receivedHmac)) {
      // Reject anything we can't cryptographically trust.
      res.status(401).json({ success: false, message: "Invalid signature." });
      return;
    }

    // Correlate the transaction back to our order via the merchant order id
    // (the special_reference we sent when creating the intention).
    const orderInfo = obj.order as Record<string, unknown> | undefined;
    const reference = String(orderInfo?.merchant_order_id ?? "");
    if (!reference) {
      res.status(200).json({ success: true }); // ack; nothing to update
      return;
    }

    const order = await Order.findOne({ "payment.reference": reference });
    if (!order) {
      res.status(200).json({ success: true }); // unknown order — ack to stop retries
      return;
    }

    // Ignore duplicate callbacks for an already-settled order.
    if (order.payment.status === "paid") {
      res.status(200).json({ success: true });
      return;
    }

    const success = obj.success === true || obj.success === "true";

    if (success) {
      order.payment.status = "paid";
      order.payment.transactionId = String(obj.id ?? "");
      order.payment.providerOrderId = String(orderInfo?.id ?? "");
      order.payment.paidAt = new Date();
      order.status = "confirmed";
      await order.save();

      // Payment confirmed — now it's safe to empty the shopper's cart.
      await Cart.findOneAndUpdate({ user: order.user }, { items: [] });
    } else {
      order.payment.status = "failed";
      await order.save();
    }

    res.status(200).json({ success: true });
  } catch {
    // Always 200 on our errors so Paymob doesn't hammer us with retries;
    // failures are observable via the order's payment status.
    res.status(200).json({ success: true });
  }
});

export default router;
