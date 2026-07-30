import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "teen-patti-dev-secret-change-in-production";

export interface TokenPayload {
  userId: number;
  username: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}
