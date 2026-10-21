import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret } from "@/lib/x-api/crypto";

const KEY_A = randomBytes(32).toString("base64");
const KEY_B = randomBytes(32).toString("base64");

describe("x-api/crypto", () => {
  const saved = process.env.X_TOKEN_ENC_KEY;
  beforeEach(() => {
    process.env.X_TOKEN_ENC_KEY = KEY_A;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.X_TOKEN_ENC_KEY;
    else process.env.X_TOKEN_ENC_KEY = saved;
  });

  it("round-trips a secret", () => {
    const blob = encryptSecret("access-token-123");
    expect(decryptSecret(blob)).toBe("access-token-123");
  });

  it("uses the v1.<iv>.<tag>.<ct> format with a 12-byte random IV per call", () => {
    const a = encryptSecret("same");
    const b = encryptSecret("same");
    expect(a).not.toBe(b);
    const parts = a.split(".");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("v1");
    expect(Buffer.from(parts[1], "base64url")).toHaveLength(12);
    expect(Buffer.from(parts[2], "base64url")).toHaveLength(16);
    expect(a).not.toContain("same");
  });

  it("throws when the auth tag is tampered with", () => {
    const [v, iv, tag, ct] = encryptSecret("secret").split(".");
    const bad = Buffer.from(tag, "base64url");
    bad[0] ^= 0xff;
    expect(() => decryptSecret([v, iv, bad.toString("base64url"), ct].join("."))).toThrow();
  });

  it("throws when the ciphertext is tampered with", () => {
    const [v, iv, tag, ct] = encryptSecret("secret").split(".");
    const bad = Buffer.from(ct, "base64url");
    bad[0] ^= 0xff;
    expect(() => decryptSecret([v, iv, tag, bad.toString("base64url")].join("."))).toThrow();
  });

  it("throws under the wrong key", () => {
    const blob = encryptSecret("secret");
    process.env.X_TOKEN_ENC_KEY = KEY_B;
    expect(() => decryptSecret(blob)).toThrow();
  });

  it("throws when the key env is missing", () => {
    delete process.env.X_TOKEN_ENC_KEY;
    expect(() => encryptSecret("x")).toThrow(/X_TOKEN_ENC_KEY/);
    expect(() => decryptSecret("v1.a.b.c")).toThrow(/X_TOKEN_ENC_KEY/);
  });

  it("throws when the key is not 32 bytes", () => {
    process.env.X_TOKEN_ENC_KEY = Buffer.from("short").toString("base64");
    expect(() => encryptSecret("x")).toThrow(/32 bytes/);
  });

  it("rejects a truncated auth tag even when the prefix is genuine (no short-tag forgery)", () => {
    const [v, iv, tag, ct] = encryptSecret("secret").split(".");
    const short = Buffer.from(tag, "base64url").subarray(0, 4).toString("base64url");
    expect(() => decryptSecret([v, iv, short, ct].join("."))).toThrow();
  });

  it("rejects an IV that is not 12 bytes", () => {
    const [v, , tag, ct] = encryptSecret("secret").split(".");
    const badIv = randomBytes(16).toString("base64url");
    expect(() => decryptSecret([v, badIv, tag, ct].join("."))).toThrow(/iv/i);
  });

  it("rejects a malformed blob", () => {
    expect(() => decryptSecret("garbage")).toThrow();
    expect(() => decryptSecret("v2.a.b.c")).toThrow();
  });
});
