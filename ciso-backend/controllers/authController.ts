import { type Request, type Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { connectDB } from "../utils/db.js";
import { getUserCollection } from "../models/User.js";

export async function signup(req: Request, res: Response) {
  console.log("➡️ Signup request body:", req.body);
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and Password required!" });
  }

  const db = await connectDB();
  console.log("✅ Connected DB in signup");

  const users = getUserCollection(db);

  const existing = await users.findOne({ email });
  console.log("🔍 Existing user:", existing);

  if (existing) return res.status(400).json({ error: "User already exists!" });

  const hashed = await bcrypt.hash(password, 10);
  await users.insertOne({ email, password: hashed });
  console.log("✅ User inserted:", email);

  res.json({ message: "Signup successful!" });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  const db = await connectDB();
  const users = getUserCollection(db);

  const user = await users.findOne({ email });
  if (!user) return res.status(401).json({ error: "Invalid credentials!" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: "Invalid credentials!" });

  const token = jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET || "secret",
    {
      expiresIn: "1h",
    }
  );
  res.json({ token });
}
