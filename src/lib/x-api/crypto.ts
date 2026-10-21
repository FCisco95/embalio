import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM at-rest encryption for X OAuth tokens.
 * Blob format: `v1.<iv>.<tag>.<ct>`, each part base64url. Fresh 12-byte IV per call.
 * Key: `X_TOKEN_ENC_KEY` (base64, 32 bytes). Throws on a missing/short key and on
 * any auth-tag failure (tampering or wrong key).
 */

const VERSION = "v1";

function loadKey(): Buffer {
  const raw = process.env.X_TOKEN_ENC_KEY;
  if (!raw) throw new Error("X_TOKEN_ENC_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("X_TOKEN_ENC_KEY must decode to 32 bytes");
  return key;
}

export function encryptSecret(plain: string): string {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, ct].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decryptSecret(blob: string): string {
  const key = loadKey();
  const parts = blob.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error("malformed secret blob");
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const ct = Buffer.from(parts[3], "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
