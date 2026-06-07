import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { Order } from "../types/order";

type OrderResponse = { success: boolean; order: Order };

// Online payments are confirmed by Paymob's webhook, which may land a moment
// after the shopper is redirected back. Poll a few times before giving up.
const MAX_POLLS = 5;
const POLL_INTERVAL_MS = 2500;

export function CheckoutCompletePage() {
  const [params] = useSearchParams();
  const orderId = params.get("order");

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollsRef = useRef(0);

  useEffect(() => {
    if (!orderId) {
      setError("No order reference provided.");
      setLoading(false);
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const data = await api.get<OrderResponse>(`/api/orders/${orderId}`);
        if (!active) return;

        setOrder(data.order);
        setLoading(false);

        // Keep polling only while an online payment is still pending.
        const stillPending =
          data.order.payment.method !== "cod" &&
          data.order.payment.status === "pending";

        if (stillPending && pollsRef.current < MAX_POLLS) {
          pollsRef.current += 1;
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load your order.");
        setLoading(false);
      }
    };

    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [orderId]);

  if (loading) {
    return (
      <section className="checkout_result">
        <div className="container">
          <div className="checkout_result_card">
            <i className="fa-solid fa-spinner fa-spin checkout_result_icon" aria-hidden="true" />
            <h1>Confirming your order…</h1>
            <p>Please wait while we verify your payment.</p>
          </div>
        </div>
      </section>
    );
  }

  if (error || !order) {
    return (
      <section className="checkout_result">
        <div className="container">
          <div className="checkout_result_card">
            <i className="fa-solid fa-circle-exclamation checkout_result_icon checkout_result_error" aria-hidden="true" />
            <h1>Something went wrong</h1>
            <p>{error ?? "We couldn't find that order."}</p>
            <Link to="/" className="btn">Back to home</Link>
          </div>
        </div>
      </section>
    );
  }

  const { payment } = order;
  const reference = order._id.slice(-8).toUpperCase();

  // Derive the message from the authoritative, server-side payment status.
  let tone: "success" | "pending" | "error" = "success";
  let icon = "fa-solid fa-circle-check";
  let title = "Thank you for your order!";
  let message = `Order #${reference} has been placed for $${order.total}.`;

  if (payment.method === "cod") {
    title = "Order confirmed!";
    message = `Order #${reference} is confirmed. Pay $${order.total} in cash on delivery.`;
  } else if (payment.status === "paid") {
    title = "Payment successful!";
    message = `Order #${reference} is paid and confirmed. Total $${order.total}.`;
  } else if (payment.status === "pending") {
    tone = "pending";
    icon = "fa-solid fa-clock";
    title = "Payment processing";
    message = `We're still waiting to confirm payment for order #${reference}. This page will update automatically, or check your orders shortly.`;
  } else {
    tone = "error";
    icon = "fa-solid fa-circle-xmark";
    title = "Payment was not completed";
    message = `Order #${reference} could not be paid. You can try again from your cart.`;
  }

  return (
    <section className="checkout_result">
      <div className="container">
        <div className="checkout_result_card">
          <i
            className={`${icon} checkout_result_icon checkout_result_${tone}`}
            aria-hidden="true"
          />
          <h1>{title}</h1>
          <p>{message}</p>
          <div className="checkout_result_actions">
            {tone === "error" ? (
              <Link to="/cart" className="btn">Return to cart</Link>
            ) : (
              <Link to="/" className="btn">Continue shopping</Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
