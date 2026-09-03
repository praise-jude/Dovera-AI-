import { createHmac, timingSafeEqual } from "node:crypto";

if (!process.env.PAYSTACK_SECRET_KEY) {
  throw new Error("PAYSTACK_SECRET_KEY environment variable is required");
}
const SECRET_KEY: string = process.env.PAYSTACK_SECRET_KEY;

const BASE_URL = "https://api.paystack.co";

class PaystackError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

interface PaystackEnvelope {
  status: boolean;
  message?: string;
  data: unknown;
}

async function paystackFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${SECRET_KEY}`,
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });
  const body = (await res.json().catch(() => null)) as PaystackEnvelope | null;
  if (!res.ok || body?.status === false) {
    throw new PaystackError(body?.message || `Paystack request failed (${res.status})`, res.status);
  }
  return body!.data as T;
}

export interface PaystackPlan {
  id: number;
  plan_code: string;
  name: string;
  amount: number;
  interval: string;
  currency: string;
}

export async function createPlan(opts: {
  name: string;
  amountKobo: number;
  interval: "monthly" | "annually" | "weekly" | "daily";
  currency: string;
}): Promise<PaystackPlan> {
  return paystackFetch<PaystackPlan>("/plan", {
    method: "POST",
    body: JSON.stringify({
      name: opts.name,
      amount: opts.amountKobo,
      interval: opts.interval,
      currency: opts.currency,
    }),
  });
}

export interface InitializeResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export async function initializeTransaction(opts: {
  email: string;
  amountKobo: number;
  planCode: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<InitializeResult> {
  return paystackFetch<InitializeResult>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: opts.email,
      amount: opts.amountKobo,
      plan: opts.planCode,
      reference: opts.reference,
      callback_url: opts.callbackUrl,
      metadata: opts.metadata,
    }),
  });
}

export interface VerifyResult {
  status: string; // "success" | "failed" | "abandoned" | ...
  reference: string;
  amount: number;
  currency: string;
  customer: { email: string };
  plan?: { plan_code: string } | null;
  authorization?: { authorization_code: string };
  paid_at: string | null;
}

export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  return paystackFetch<VerifyResult>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

export interface SubscriptionDetail {
  subscription_code: string;
  email_token: string;
  status: string;
  next_payment_date: string | null;
}

export async function fetchSubscription(code: string): Promise<SubscriptionDetail> {
  return paystackFetch<SubscriptionDetail>(`/subscription/${encodeURIComponent(code)}`);
}

export async function disableSubscription(code: string, token: string): Promise<void> {
  await paystackFetch("/subscription/disable", {
    method: "POST",
    body: JSON.stringify({ code, token }),
  });
}

/**
 * Paystack signs webhook bodies with HMAC-SHA512 of the raw (unparsed) JSON
 * bytes, keyed with the secret key. Must run against the exact raw body —
 * re-serializing a parsed object can produce different bytes (key order,
 * whitespace) and silently break verification.
 */
export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha512", SECRET_KEY).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const givenBuf = Buffer.from(signatureHeader, "utf8");
  if (expectedBuf.length !== givenBuf.length) return false;
  return timingSafeEqual(expectedBuf, givenBuf);
}
