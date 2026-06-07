export type PaymentMethod = "cod" | "card" | "wallet";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled";

export type Order = {
  _id: string;
  total: number;
  status: OrderStatus;
  billing: { name: string; email: string; phone: string };
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    provider: "cod" | "paymob";
    reference?: string;
    transactionId?: string;
    paidAt?: string;
  };
  items: { productId: number; name: string; img: string; price: number; quantity: number }[];
  createdAt: string;
};

// Response from POST /api/orders
export type PlaceOrderResponse = {
  success: boolean;
  order: Order;
  message?: string;
  payment?: {
    provider: "paymob";
    checkoutUrl: string;
    clientSecret: string;
  };
};
