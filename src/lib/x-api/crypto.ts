import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM at-rest encryption for X OAuth tokens.
 * Blob format: `v1.<iv>.<tag>.<ct>`, each part base64url. Fresh 12-byte IV per call.
 * Key: `X_TOKEN_ENC_KEY` (base64, 32 bytes). Throws on a missing/short key and on
 * any auth-tag failure (tampering or wrong key).
 */

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function loadKey(): Buffer {
  const raw = process.env.X_TOKEN_ENC_KEY;
  if (!raw) throw new Error("X_TOKEN_ENC_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("X_TOKEN_ENC_KEY must decode to 32 bytes");
  return key;
}

export function encryptSecret(plain: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
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
  // Pin the shapes: Node accepts truncated GCM tags unless authTagLength is set, and a
  // short tag is a forgery risk. IV must be exactly the 12 bytes we generate.
  if (iv.length !== IV_BYTES) throw new Error("malformed secret blob: bad iv length");
  if (tag.length !== TAG_BYTES) throw new Error("malformed secret blob: bad auth tag length");
  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
