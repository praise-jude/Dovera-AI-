import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
const JWT_SECRET: string = process.env.JWT_SECRET;

export interface AuthedRequest extends Request {
  userId?: string;
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "30d" });
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  // Media elements (<video>/<img> src) can't send an Authorization header,
  // so a GET-only query-param fallback lets asset URLs be used directly —
  // still just the same bearer JWT, still scoped to its owning user by every
  // route that looks up an asset via req.userId.
  const queryToken = req.method === "GET" && typeof req.query.token === "string" ? req.query.token : null;
  const token = (header?.startsWith("Bearer ") ? header.slice(7) : null) ?? queryToken;
  if (!token) {
    res.status(401).json({ error: "Sign in required." });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
}
