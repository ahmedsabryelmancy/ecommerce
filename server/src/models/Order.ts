import mongoose, { Document, Schema } from "mongoose";

type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";

// How the customer chose to pay.
export type PaymentMethod = "cod" | "card" | "wallet";
// Lifecycle of the payment itself (independent of fulfilment status).
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type PaymentProvider = "cod" | "paymob";

interface OrderItem {
  productId: number;
  name: string;
  img: string;
  price: number;
  quantity: number;
}

interface BillingInfo {
  name: string;
  email: string;
  phone: string;
}

interface PaymentInfo {
  method: PaymentMethod;
  status: PaymentStatus;
  provider: PaymentProvider;
  // Our unique reference sent to the gateway (maps to merchant_order_id / special_reference).
  reference?: string;
  // Gateway-side identifiers, captured from the webhook.
  providerOrderId?: string;
  transactionId?: string;
  paidAt?: Date;
}

export interface IOrder extends Document {
  user: mongoose.Types.ObjectId;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  billing: BillingInfo;
  payment: PaymentInfo;
  createdAt: Date;
}

const orderItemSchema = new Schema<OrderItem>(
  {
    productId: { type: Number, required: true },
    name: { type: String, required: true },
    img: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const billingSchema = new Schema<BillingInfo>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
  },
  { _id: false }
);

const paymentSchema = new Schema<PaymentInfo>(
  {
    method: {
      type: String,
      enum: ["cod", "card", "wallet"],
      required: true,
      default: "cod",
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      required: true,
      default: "pending",
    },
    provider: {
      type: String,
      enum: ["cod", "paymob"],
      required: true,
      default: "cod",
    },
    reference: { type: String, index: true },
    providerOrderId: String,
    transactionId: String,
    paidAt: Date,
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: [orderItemSchema],
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    billing: { type: billingSchema, required: true },
    payment: { type: paymentSchema, required: true },
  },
  { timestamps: true }
);

export const Order = mongoose.model<IOrder>("Order", orderSchema);
