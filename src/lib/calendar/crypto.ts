import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** A 32-byte key from TOKEN_ENCRYPTION_KEY, whatever format that secret is in. */
function key(secret = process.env.TOKEN_ENCRYPTION_KEY): Buffer {
  if (!secret) throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  return createHash("sha256").update(secret).digest();
}

/** Encrypt a Google token for storage (AES-256-GCM). */
export function encryptToken(plain: string, secret?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64")}`;
}

export function decryptToken(stored: string, secret?: string): string {
  if (!stored.startsWith("v1:")) throw new Error("Unknown token format");
  const raw = Buffer.from(stored.slice(3), "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(secret), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}
