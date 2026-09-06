import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../db.js";
import { signToken, requireAuth, type AuthedRequest } from "../lib/auth.js";

export const authRouter = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  name: z.string().min(1).max(80).optional(),
});

authRouter.post("/register", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    return;
  }
  const { email, password, name } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.create({
    data: { email, passwordHash, name },
  });

  res.status(201).json({
    token: signToken(user.id),
    user: { id: user.id, email: user.email, name: user.name, plan: user.plan, credits: user.credits },
  });
});

authRouter.post("/login", async (req, res) => {
  const parsed = credentialsSchema.pick({ email: true, password: true }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid email and password." });
    return;
  }
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Incorrect email or password." });
    return;
  }

  res.json({
    token: signToken(user.id),
    user: { id: user.id, email: user.email, name: user.name, plan: user.plan, credits: user.credits },
  });
});

function isDeviceAccount(email: string): boolean {
  return email.endsWith("@vidora.local");
}

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await db.user.findUnique({ where: { id: req.userId! } });
  if (!user) {
    res.status(404).json({ error: "Account not found." });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    credits: user.credits,
    isDeviceAccount: isDeviceAccount(user.email),
  });
});

// Lets a user turn this device's auto-created account into one they can log
// into elsewhere (or just change their email/password on a real account).
// Deliberately does not require the account to currently be a device
// account — this is ordinary "update my credentials" behavior either way.
authRouter.patch("/credentials", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = credentialsSchema.pick({ email: true, password: true }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    return;
  }
  const { email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing && existing.id !== req.userId) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.update({
    where: { id: req.userId! },
    data: { email, passwordHash },
  });

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    credits: user.credits,
    isDeviceAccount: isDeviceAccount(user.email),
  });
});
