import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { api } from "../lib/api";
import { getProductImagePath } from "../features/products/hooks/useProducts";
import { PaymentMethod, PlaceOrderResponse } from "../types/order";

type MethodOption = {
  id: PaymentMethod;
  label: string;
  description: string;
  icon: string;
};

const PAYMENT_METHODS: MethodOption[] = [
  {
    id: "cod",
    label: "Cash on Delivery",
    description: "Pay with cash when your order arrives.",
    icon: "fa-solid fa-money-bill-wave",
  },
  {
    id: "card",
    label: "Credit / Debit Card",
    description: "Secure card payment via Paymob.",
    icon: "fa-solid fa-credit-card",
  },
  {
    id: "wallet",
    label: "Mobile Wallet",
    description: "Vodafone Cash, Etisalat, Orange & more via Paymob.",
    icon: "fa-solid fa-wallet",
  },
];

export function CheckoutPage() {
  const { user } = useAuth();
  const { cartItems, cartTotal } = useCart();
  const navigate = useNavigate();

  const [method, setMethod] = useState<PaymentMethod>("cod");
  const [billing, setBilling] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Checkout requires an account (orders are tied to a user).
  if (!user) {
    return <Navigate to="/login" replace state={{ redirectTo: "/checkout" }} />;
  }

  // Nothing to check out — bounce back to the cart.
  if (!cartItems.length) {
    return <Navigate to="/cart" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const data = await api.post<PlaceOrderResponse>("/api/orders", {
        paymentMethod: method,
        billing,
      });

      if (!data.success) {
        setError(data.message ?? "Could not place your order.");
        setSubmitting(false);
        return;
      }

      // Online payment → hand off to the Paymob hosted checkout.
      if (data.payment?.checkoutUrl) {
        window.location.href = data.payment.checkoutUrl;
        return;
      }

      // Cash on delivery → straight to the confirmation page.
      navigate(`/checkout/complete?order=${data.order._id}&status=success`, {
        replace: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place your order.");
      setSubmitting(false);
    }
  };

  const onField =
    (field: keyof typeof billing) => (event: { target: { value: string } }) =>
      setBilling((current) => ({ ...current, [field]: event.target.value }));

  return (
    <section className="checkout_page">
      <div className="container">
        <div className="checkout_header">
          <p className="cart_page_eyebrow">Checkout</p>
          <h1>Complete your order</h1>
          <p>Confirm your details and choose how you'd like to pay.</p>
        </div>

        <form className="checkout_layout" onSubmit={handleSubmit}>
          <div className="checkout_main">
            {/* ── Billing details ── */}
            <div className="checkout_card">
              <h2>Billing details</h2>
              <div className="checkout_fields">
                <label>
                  <span>Full name</span>
                  <input
                    type="text"
                    value={billing.name}
                    onChange={onField("name")}
                    placeholder="Jane Doe"
                    required
                  />
                </label>
                <label>
                  <span>Email</span>
                  <input
                    type="email"
                    value={billing.email}
                    onChange={onField("email")}
                    placeholder="jane@example.com"
                    required
                  />
                </label>
                <label>
                  <span>Phone</span>
                  <input
                    type="tel"
                    value={billing.phone}
                    onChange={onField("phone")}
                    placeholder="+20 100 000 0000"
                    required
                  />
                </label>
              </div>
            </div>

            {/* ── Payment method ── */}
            <div className="checkout_card">
              <h2>Payment method</h2>
              <div className="payment_methods">
                {PAYMENT_METHODS.map((option) => (
                  <label
                    key={option.id}
                    className={`payment_method ${method === option.id ? "payment_method_active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={option.id}
                      checked={method === option.id}
                      onChange={() => setMethod(option.id)}
                    />
                    <i className={option.icon} aria-hidden="true" />
                    <span className="payment_method_text">
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                  </label>
                ))}
              </div>

              {method !== "cod" ? (
                <p className="payment_redirect_note">
                  <i className="fa-solid fa-lock" aria-hidden="true" /> You'll be redirected
                  to Paymob's secure checkout to complete payment.
                </p>
              ) : null}
            </div>
          </div>

          {/* ── Order summary ── */}
          <aside className="checkout_summary">
            <h2>Order summary</h2>
            <ul className="checkout_summary_items">
              {cartItems.map((item) => (
                <li key={item.product.id}>
                  <img
                    src={getProductImagePath(item.product.img)}
                    alt={item.product.name}
                  />
                  <span className="checkout_summary_name">
                    {item.product.name}
                    <small>Qty {item.quantity}</small>
                  </span>
                  <span className="checkout_summary_price">
                    ${item.product.price * item.quantity}
                  </span>
                </li>
              ))}
            </ul>

            <div className="checkout_summary_rows">
              <div>
                <span>Subtotal</span>
                <strong>${cartTotal}</strong>
              </div>
              <div>
                <span>Shipping</span>
                <strong>Free</strong>
              </div>
              <div className="checkout_summary_total">
                <span>Total</span>
                <strong>${cartTotal}</strong>
              </div>
            </div>

            {error ? (
              <p className="cart_checkout_error" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" className="btn checkout_submit" disabled={submitting}>
              {submitting
                ? "Processing…"
                : method === "cod"
                  ? "Place order"
                  : `Pay $${cartTotal}`}
            </button>

            <Link to="/cart" className="cart_continue_link">
              Back to cart
            </Link>
          </aside>
        </form>
      </div>
    </section>
  );
}
