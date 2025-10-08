import { type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { type AuthRequest } from "../types/AuthRequest.js";

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Missing Token!" });

  let token: string;

  if (header.startsWith("Bearer ")) {
    token = header.split(" ")[1] as string;
  } else {
    token = header;
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ error: "JWT secret not configured" });
    }
    const decoded = jwt.verify(token, jwtSecret);
    (req as any).user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid token" });
  }
}
