import "dotenv/config";
import express from "express";
import cors from "cors";
import { ensureStorageRoot } from "./lib/storage.js";
import { authRouter } from "./routes/auth.js";
import { projectsRouter } from "./routes/projects.js";
import { assetsRouter } from "./routes/assets.js";
import { jobsRouter } from "./routes/jobs.js";
import { providersRouter } from "./routes/providers.js";
import { billingRouter, handlePaystackWebhook } from "./routes/billing.js";
import { verifyWebhookSignature } from "./lib/paystack.js";

const app = express();

const allowedOrigin = process.env.CORS_ORIGIN;
app.use(cors({ origin: allowedOrigin ? allowedOrigin.split(",") : true }));

// Paystack signs the raw request bytes — this route must read the body as a
// Buffer, before the global JSON parser below re-serializes/normalizes it,
// or signature verification will fail (or worse, be silently skippable).
app.post("/billing/webhook", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
  const signature = req.header("x-paystack-signature");
  if (!verifyWebhookSignature(req.body, signature)) {
    res.status(401).json({ error: "Invalid signature." });
    return;
  }
  let event: { event: string; data: any };
  try {
    event = JSON.parse(req.body.toString("utf8"));
  } catch {
    res.status(400).json({ error: "Malformed payload." });
    return;
  }
  // Acknowledge immediately; Paystack retries on non-2xx/timeout.
  res.status(200).json({ received: true });
  try {
    await handlePaystackWebhook(req.body, event);
  } catch (err) {
    console.error("Webhook handling failed:", err);
  }
});

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/projects", projectsRouter);
app.use("/assets", assetsRouter);
app.use("/jobs", jobsRouter);
app.use("/providers", providersRouter);
app.use("/billing", billingRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

// Last-resort handler: never leak stack traces or raw error text to clients.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Something went wrong on our end. Please try again." });
});

const PORT = Number(process.env.PORT) || 8080;

await ensureStorageRoot();
app.listen(PORT, () => {
  console.log(`VIDORA API listening on port ${PORT}`);
});
