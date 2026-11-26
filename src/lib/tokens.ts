import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** Random invitation token (goes in the email link) and its SHA-256 hash (stored). */
export function newInvitationToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
