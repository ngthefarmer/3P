import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createUser, getUserByUsername, MIN_BALANCE_FLOOR, setChipBalance } from "../db.js";
import { signToken } from "./jwt.js";

export const authRouter = Router();

const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username may only contain letters, numbers, and underscores"),
  password: z.string().min(4, "Password must be at least 4 characters").max(100),
});

function publicUser(user: { id: number; username: string; chip_balance: number }) {
  return { id: user.id, username: user.username, chipBalance: user.chip_balance };
}

authRouter.post("/register", (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const { username, password } = parsed.data;

  if (getUserByUsername(username)) {
    return res.status(409).json({ error: "Username already taken" });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const user = createUser(username, passwordHash);
  const token = signToken({ userId: user.id, username: user.username });
  res.json({ token, user: publicUser(user) });
});

authRouter.post("/login", (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const { username, password } = parsed.data;

  const user = getUserByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  // Top up players who have busted so they're never permanently locked out.
  if (user.chip_balance < MIN_BALANCE_FLOOR) {
    setChipBalance(user.id, MIN_BALANCE_FLOOR);
    user.chip_balance = MIN_BALANCE_FLOOR;
  }

  const token = signToken({ userId: user.id, username: user.username });
  res.json({ token, user: publicUser(user) });
});
