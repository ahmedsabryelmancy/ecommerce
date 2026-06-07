import { Router, Response } from "express";
import { Order, PaymentMethod } from "../models/Order";
import { Cart } from "../models/Cart";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { createIntention, isPaymobConfigured } from "../services/paymob";

const router = Router();
router.use(requireAuth);

const VALID_METHODS: PaymentMethod[] = ["cod", "card", "wallet"];

// Base URLs for gateway callbacks. SERVER_URL must be publicly reachable for
// Paymob to deliver the webhook; FRONTEND_URL is where the shopper is returned.
const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:5000";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

// POST /api/orders  — place an order from the current cart.
// Body: { paymentMethod: "cod" | "card" | "wallet", billing: { name, email, phone } }
router.post("/", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { paymentMethod = "cod", billing } = req.body as {
      paymentMethod?: PaymentMethod;
      billing?: { name?: string; email?: string; phone?: string };
    };

    if (!VALID_METHODS.includes(paymentMethod)) {
      res.status(400).json({ success: false, message: "Invalid payment method." });
      return;
    }

    if (!billing?.name?.trim() || !billing?.email?.trim() || !billing?.phone?.trim()) {
      res.status(400).json({
        success: false,
        message: "Billing name, email and phone are required.",
      });
      return;
    }

    const cart = await Cart.findOne({ user: req.userId });
    if (!cart || cart.items.length === 0) {
      res.status(400).json({ success: false, message: "Your cart is empty." });
      return;
    }

    const items = cart.items.map((item) => ({
      productId: item.productSnapshot.id,
      name: item.productSnapshot.name,
      img: item.productSnapshot.img,
      price: item.productSnapshot.price,
      quantity: item.quantity,
    }));

    // Total is always computed server-side from snapshots — never trust the client.
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const isOnline = paymentMethod === "card" || paymentMethod === "wallet";

    const order = await Order.create({
      user: req.userId,
      items,
      total,
      // COD orders are confirmed immediately; online orders stay pending until paid.
      status: isOnline ? "pending" : "confirmed",
      billing: {
        name: billing.name.trim(),
        email: billing.email.trim(),
        phone: billing.phone.trim(),
      },
      payment: {
        method: paymentMethod,
        provider: isOnline ? "paymob" : "cod",
        status: "pending",
      },
    });

    // ── Cash on delivery: nothing to charge, finalise immediately. ──
    if (!isOnline) {
      cart.items = [];
      await cart.save();
      res.status(201).json({ success: true, order });
      return;
    }

    // ── Card / wallet: start a Paymob payment intention. ──
    if (!isPaymobConfigured()) {
      // Roll back the order we just created so we don't leave a dangling pending order.
      await order.deleteOne();
      res.status(503).json({
        success: false,
        message: "Online payments are not configured. Please use Cash on Delivery.",
      });
      return;
    }

    // Unique reference correlating the gateway transaction back to this order.
    const specialReference = `${String(order._id)}-${Date.now()}`;
    order.payment.reference = specialReference;
    await order.save();

    try {
      const { checkoutUrl, clientSecret } = await createIntention({
        method: paymentMethod,
        amountCents: Math.round(total * 100),
        items: items.map((item) => ({
          name: item.name,
          amount: Math.round(item.price * 100),
          quantity: item.quantity,
        })),
        billing: {
          name: billing.name.trim(),
          email: billing.email.trim(),
          phone: billing.phone.trim(),
        },
        specialReference,
        notificationUrl: `${SERVER_URL}/api/payments/paymob/webhook`,
        redirectionUrl: `${FRONTEND_URL}/checkout/complete?order=${String(order._id)}`,
      });

      // Cart is intentionally NOT cleared here — only after the webhook confirms payment.
      res.status(201).json({
        success: true,
        order,
        payment: { provider: "paymob", checkoutUrl, clientSecret },
      });
    } catch (err) {
      order.payment.status = "failed";
      await order.save();
      res.status(502).json({
        success: false,
        message: err instanceof Error ? err.message : "Failed to start payment.",
      });
    }
  } catch {
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// GET /api/orders  — current user's order history
router.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orders = await Order.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, orders });
  } catch {
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// GET /api/orders/:orderId  — single order detail
router.get("/:orderId", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.userId,
    }).lean();

    if (!order) {
      res.status(404).json({ success: false, message: "Order not found." });
      return;
    }

    res.json({ success: true, order });
  } catch {
    res.status(500).json({ success: false, message: "Server error." });
  }
});

export default router;
