import crypto from "crypto";
import { PaymentMethod } from "../models/Order";

// ── Paymob (Accept) integration ───────────────────────────
// Uses the Unified Intention API:
//   1. POST /v1/intention/ with the secret key → returns a client_secret
//   2. Redirect the shopper to the unified checkout URL built from the
//      public key + client_secret
//   3. Paymob calls our webhook (notification_url) with the transaction
//      result, signed with an HMAC we verify before trusting it.
//
// Docs: https://developers.paymob.com/egypt/checkout-api-unified-intention

const API_BASE = process.env.PAYMOB_API_BASE ?? "https://accept.paymob.com";

const SECRET_KEY = process.env.PAYMOB_SECRET_KEY ?? "";
const PUBLIC_KEY = process.env.PAYMOB_PUBLIC_KEY ?? "";
const HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET ?? "";
const CARD_INTEGRATION_ID = process.env.PAYMOB_CARD_INTEGRATION_ID ?? "";
const WALLET_INTEGRATION_ID = process.env.PAYMOB_WALLET_INTEGRATION_ID ?? "";
const CURRENCY = process.env.PAYMOB_CURRENCY ?? "EGP";

/** True only when every secret needed to talk to Paymob is present. */
export function isPaymobConfigured(): boolean {
  return Boolean(SECRET_KEY && PUBLIC_KEY && HMAC_SECRET);
}

/** Resolve the gateway integration id(s) for the chosen method. */
function integrationIdsFor(method: PaymentMethod): number[] {
  const id = method === "wallet" ? WALLET_INTEGRATION_ID : CARD_INTEGRATION_ID;
  return id
    .split(",")
    .map((v) => parseInt(v.trim(), 10))
    .filter((v) => Number.isFinite(v));
}

type IntentionItem = { name: string; amount: number; quantity: number };

type CreateIntentionArgs = {
  method: PaymentMethod;
  amountCents: number;
  items: IntentionItem[];
  billing: { name: string; email: string; phone: string };
  specialReference: string;
  notificationUrl: string;
  redirectionUrl: string;
};

type IntentionResult = {
  clientSecret: string;
  checkoutUrl: string;
};

/** Split a full name into first/last for Paymob's billing_data. */
function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  const first = parts.shift() || "NA";
  const last = parts.length ? parts.join(" ") : "NA";
  return { first, last };
}

/**
 * Create a payment intention and return the hosted checkout URL to redirect to.
 * Throws if Paymob rejects the request.
 */
export async function createIntention(args: CreateIntentionArgs): Promise<IntentionResult> {
  const integrationIds = integrationIdsFor(args.method);
  if (integrationIds.length === 0) {
    throw new Error(`No Paymob integration id configured for method "${args.method}".`);
  }

  const { first, last } = splitName(args.billing.name);

  const body = {
    amount: args.amountCents,
    currency: CURRENCY,
    payment_methods: integrationIds,
    items: args.items.map((item) => ({
      name: item.name,
      amount: item.amount,
      quantity: item.quantity,
    })),
    billing_data: {
      first_name: first,
      last_name: last,
      email: args.billing.email,
      phone_number: args.billing.phone,
      apartment: "NA",
      building: "NA",
      street: "NA",
      floor: "NA",
      city: "NA",
      state: "NA",
      country: "NA",
    },
    customer: {
      first_name: first,
      last_name: last,
      email: args.billing.email,
    },
    special_reference: args.specialReference,
    notification_url: args.notificationUrl,
    redirection_url: args.redirectionUrl,
  };

  const response = await fetch(`${API_BASE}/v1/intention/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${SECRET_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as { client_secret?: string; detail?: string };

  if (!response.ok || !data.client_secret) {
    throw new Error(data.detail ?? `Paymob intention failed (${response.status}).`);
  }

  return {
    clientSecret: data.client_secret,
    checkoutUrl: `${API_BASE}/unifiedcheckout/?publicKey=${PUBLIC_KEY}&clientSecret=${data.client_secret}`,
  };
}

// Fields Paymob concatenates (in this exact order) to build the transaction HMAC.
const HMAC_FIELDS = [
  "amount_cents",
  "created_at",
  "currency",
  "error_occured",
  "has_parent_transaction",
  "id",
  "integration_id",
  "is_3d_secure",
  "is_auth",
  "is_capture",
  "is_refunded",
  "is_standalone_payment",
  "is_voided",
  "order",          // -> obj.order.id
  "owner",
  "pending",
  "source_data_pan",      // -> obj.source_data.pan
  "source_data_sub_type", // -> obj.source_data.sub_type
  "source_data_type",     // -> obj.source_data.type
  "success",
] as const;

/** Read a possibly-nested HMAC field from the transaction object. */
function hmacFieldValue(obj: Record<string, unknown>, field: string): string {
  let raw: unknown;
  if (field === "order") {
    raw = (obj.order as Record<string, unknown> | undefined)?.id;
  } else if (field.startsWith("source_data_")) {
    const key = field.replace("source_data_", "");
    raw = (obj.source_data as Record<string, unknown> | undefined)?.[key];
  } else {
    raw = obj[field];
  }
  // Paymob serialises booleans as lowercase "true"/"false".
  if (typeof raw === "boolean") return raw ? "true" : "false";
  return raw === undefined || raw === null ? "" : String(raw);
}

/**
 * Verify the HMAC Paymob attaches to a transaction callback.
 * `obj` is the `obj` field of the webhook payload; `receivedHmac` is the
 * `hmac` query-string parameter on the callback request.
 */
export function verifyHmac(obj: Record<string, unknown>, receivedHmac: string): boolean {
  if (!HMAC_SECRET || !receivedHmac) return false;

  const concatenated = HMAC_FIELDS.map((field) => hmacFieldValue(obj, field)).join("");
  const expected = crypto
    .createHmac("sha512", HMAC_SECRET)
    .update(concatenated)
    .digest("hex");

  // Constant-time compare to avoid leaking timing information.
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(receivedHmac, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
