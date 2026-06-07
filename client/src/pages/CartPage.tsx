import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { api } from "../lib/api";
import { getProductImagePath } from "../features/products/hooks/useProducts";

// Shape of the order returned by POST /api/orders
type PlacedOrder = {
  _id: string;
  total: number;
  status: string;
  items: { productId: number; name: string; quantity: number; price: number }[];
};

type OrderApiResponse = {
  success: boolean;
  order: PlacedOrder;
  message?: string;
};

export function CartPage() {
  const {
    addToCart,
    cartItems,
    cartTotal,
    clearCart,
    decreaseQuantity,
    removeFromCart,
  } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [placing, setPlacing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);

  const handleCheckout = async () => {
    // Orders require an authenticated user. Guests are sent to login first;
    // their cart persists in localStorage and merges on login.
    if (!user) {
      navigate("/login", { state: { redirectTo: "/cart" } });
      return;
    }

    setPlacing(true);
    setCheckoutError(null);

    try {
      const data = await api.post<OrderApiResponse>("/api/orders");
      if (data.success) {
        setPlacedOrder(data.order);
        clearCart(); // backend already emptied the cart; sync local state
      } else {
        setCheckoutError(data.message ?? "Could not place your order.");
      }
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : "Could not place your order.",
      );
    } finally {
      setPlacing(false);
    }
  };

  // Order confirmation — shown after a successful checkout.
  if (placedOrder) {
    return (
      <section className="cart_page">
        <div className="container">
          <div className="cart_empty_state">
            <p className="cart_page_eyebrow">Order confirmed</p>
            <h1>Thank you for your order!</h1>
            <p>
              Order <strong>#{placedOrder._id.slice(-8).toUpperCase()}</strong> has been
              placed for <strong>${placedOrder.total}</strong>. Status:{" "}
              {placedOrder.status}.
            </p>
            <Link to="/" className="btn">
              Continue shopping
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!cartItems.length) {
    return (
      <section className="cart_page">
        <div className="container">
          <div className="cart_empty_state">
            <p className="cart_page_eyebrow">Your basket</p>
            <h1>Your cart is empty</h1>
            <p>Add products from the home page or any product screen to build your order.</p>
            <Link to="/" className="btn">
              Continue shopping
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="cart_page">
      <div className="container">
        <div className="cart_page_header">
          <div>
            <p className="cart_page_eyebrow">Your basket</p>
            <h1>Review your cart</h1>
            <p>{cartItems.length} unique products ready for checkout.</p>
          </div>

          <button type="button" className="cart_clear_button" onClick={clearCart}>
            Clear cart
          </button>
        </div>

        <div className="cart_layout">
          <div className="cart_items_list">
            {cartItems.map((item) => (
              <article className="cart_item_card" key={item.product.id}>
                <Link to={`/products/${item.product.id}`} className="cart_item_media">
                  <img
                    src={getProductImagePath(item.product.img)}
                    alt={item.product.name}
                  />
                </Link>

                <div className="cart_item_content">
                  <div className="cart_item_head">
                    <div>
                      <p className="cart_item_category">{item.product.catetory}</p>
                      <Link to={`/products/${item.product.id}`} className="cart_item_name">
                        {item.product.name}
                      </Link>
                    </div>

                    <button
                      type="button"
                      className="cart_remove_button"
                      onClick={() => removeFromCart(item.product.id)}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="cart_item_footer">
                    <div className="cart_quantity_control">
                      <button
                        type="button"
                        onClick={() => decreaseQuantity(item.product.id)}
                        aria-label={`Decrease quantity of ${item.product.name}`}
                      >
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => addToCart(item.product)}
                        aria-label={`Increase quantity of ${item.product.name}`}
                      >
                        +
                      </button>
                    </div>

                    <div className="cart_price_block">
                      <strong>${item.product.price * item.quantity}</strong>
                      <span>${item.product.price} each</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <aside className="cart_summary_card">
            <p className="cart_page_eyebrow">Order summary</p>
            <h2>Total</h2>

            <div className="cart_summary_rows">
              <div>
                <span>Items</span>
                <strong>{cartItems.reduce((sum, item) => sum + item.quantity, 0)}</strong>
              </div>
              <div>
                <span>Shipping</span>
                <strong>Free</strong>
              </div>
              <div>
                <span>Subtotal</span>
                <strong>${cartTotal}</strong>
              </div>
            </div>

            <button
              type="button"
              className="btn cart_checkout_button"
              onClick={handleCheckout}
              disabled={placing}
            >
              {placing
                ? "Placing order…"
                : user
                  ? "Proceed to checkout"
                  : "Log in to checkout"}
            </button>

            {checkoutError ? (
              <p className="cart_checkout_error" role="alert">
                {checkoutError}
              </p>
            ) : null}

            <Link to="/" className="cart_continue_link">
              Continue shopping
            </Link>
          </aside>
        </div>
      </div>
    </section>
  );
}