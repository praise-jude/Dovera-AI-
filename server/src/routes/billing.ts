import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { requireAuth, type AuthedRequest } from "../lib/auth.js";
import * as paystack from "../lib/paystack.js";

const PLAN_CODE = process.env.PAYSTACK_PLAN_CODE;
const AMOUNT_KOBO = 10_000 * 100; // Premium: NGN 10,000/month
const CURRENCY = "NGN";

const FRONTEND_ORIGIN = process.env.CORS_ORIGIN?.split(",")[0] || "https://dovera-ai-production.up.railway.app";

export const billingRouter = Router();
billingRouter.use(requireAuth);

billingRouter.get("/status", async (req: AuthedRequest, res) => {
  const user = await db.user.findUniqueOrThrow({ where: { id: req.userId! } });
  res.json({
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
    planRenewsAt: user.planRenewsAt,
    amountKobo: AMOUNT_KOBO,
    currency: CURRENCY,
  });
});

billingRouter.post("/subscribe", async (req: AuthedRequest, res) => {
  if (!PLAN_CODE) {
    res.status(503).json({ error: "Subscriptions aren't configured yet. Please try again shortly." });
    return;
  }
  const user = await db.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (user.subscriptionStatus === "ACTIVE") {
    res.status(409).json({ error: "You already have an active Premium subscription." });
    return;
  }

  const reference = `vidora_${randomUUID()}`;
  try {
    const init = await paystack.initializeTransaction({
      email: user.email,
      amountKobo: AMOUNT_KOBO,
      planCode: PLAN_CODE,
      reference,
      callbackUrl: FRONTEND_ORIGIN,
      metadata: { userId: user.id },
    });

    await db.payment.create({
      data: {
        userId: user.id,
        reference,
        amountKobo: AMOUNT_KOBO,
        currency: CURRENCY,
        status: "pending",
      },
    });

    res.status(201).json({ authorizationUrl: init.authorization_url, reference });
  } catch {
    res.status(502).json({ error: "Couldn't start checkout. Please try again." });
  }
});

billingRouter.get("/verify/:reference", async (req: AuthedRequest, res) => {
  const reference = req.params.reference as string;
  const payment = await db.payment.findFirst({ where: { reference, userId: req.userId! } });
  if (!payment) {
    res.status(404).json({ error: "Payment not found." });
    return;
  }

  if (payment.status === "success") {
    res.json({ status: "success" });
    return;
  }

  try {
    const result = await paystack.verifyTransaction(reference);
    if (result.status === "success") {
      await applySuccessfulPayment(req.userId!, reference, result);
      res.json({ status: "success" });
    } else {
      await db.payment.update({ where: { reference }, data: { status: result.status } });
      res.json({ status: result.status });
    }
  } catch {
    res.status(502).json({ error: "Couldn't verify payment right now. Please try again." });
  }
});

billingRouter.post("/cancel", async (req: AuthedRequest, res) => {
  const user = await db.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (!user.subscriptionCode || !user.subscriptionEmailToken) {
    res.status(400).json({ error: "No active subscription to cancel." });
    return;
  }
  try {
    await paystack.disableSubscription(user.subscriptionCode, user.subscriptionEmailToken);
    await db.user.update({
      where: { id: user.id },
      data: { subscriptionStatus: "CANCELLED" },
    });
    res.json({ ok: true });
  } catch {
    res.status(502).json({ error: "Couldn't cancel your subscription right now. Please try again." });
  }
});

async function applySuccessfulPayment(userId: string, reference: string, result: paystack.VerifyResult) {
  await db.$transaction([
    db.payment.update({
      where: { reference },
      data: { status: "success", raw: result as unknown as object },
    }),
    db.user.update({
      where: { id: userId },
      data: { plan: "PREMIUM", subscriptionStatus: "ACTIVE" },
    }),
  ]);
}

// --- Webhook (public, signature-verified — mounted separately with a raw body parser) ---

export async function handlePaystackWebhook(rawBody: Buffer, event: { event: string; data: any }) {
  switch (event.event) {
    case "charge.success": {
      const userId = event.data?.metadata?.userId as string | undefined;
      const reference = event.data?.reference as string | undefined;
      if (userId && reference) {
        const existing = await db.payment.findUnique({ where: { reference } });
        if (existing && existing.status !== "success") {
          await applySuccessfulPayment(userId, reference, event.data);
        } else if (!existing) {
          // Recurring charge (not the initial checkout we recorded) — log it.
          await db.payment.create({
            data: {
              userId,
              reference,
              amountKobo: event.data.amount ?? AMOUNT_KOBO,
              currency: event.data.currency ?? CURRENCY,
              status: "success",
              purpose: "renewal",
              raw: event.data,
            },
          });
          await db.user.update({ where: { id: userId }, data: { plan: "PREMIUM", subscriptionStatus: "ACTIVE" } });
        }
      }
      break;
    }
    case "subscription.create": {
      const email = event.data?.customer?.email as string | undefined;
      if (email) {
        const user = await db.user.findUnique({ where: { email } });
        if (user) {
          await db.user.update({
            where: { id: user.id },
            data: {
              subscriptionCode: event.data.subscription_code,
              subscriptionEmailToken: event.data.email_token,
              subscriptionStatus: "ACTIVE",
              plan: "PREMIUM",
              planRenewsAt: event.data.next_payment_date ? new Date(event.data.next_payment_date) : null,
            },
          });
        }
      }
      break;
    }
    case "subscription.disable": {
      const email = event.data?.customer?.email as string | undefined;
      if (email) {
        const user = await db.user.findUnique({ where: { email } });
        if (user) {
          await db.user.update({
            where: { id: user.id },
            data: { subscriptionStatus: "CANCELLED", plan: "FREE" },
          });
        }
      }
      break;
    }
    case "invoice.payment_failed": {
      const email = event.data?.customer?.email as string | undefined;
      if (email) {
        const user = await db.user.findUnique({ where: { email } });
        if (user) {
          await db.user.update({ where: { id: user.id }, data: { subscriptionStatus: "PAST_DUE" } });
        }
      }
      break;
    }
    default:
      break;
  }
}
