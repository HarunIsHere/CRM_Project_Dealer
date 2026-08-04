const textEncoder = new TextEncoder();

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createOpaqueId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export async function hashOpaqueToken(rawToken, keyMaterial) {
  if (!rawToken || !keyMaterial) {
    throw new Error("canonical token hashing is not configured");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(keyMaterial),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(rawToken)
  );
  return toHex(new Uint8Array(signature));
}

export async function constantTimeEqual(left, right) {
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", textEncoder.encode(String(left))),
    crypto.subtle.digest("SHA-256", textEncoder.encode(String(right)))
  ]);
  if (typeof crypto.subtle.timingSafeEqual === "function") {
    return crypto.subtle.timingSafeEqual(leftDigest, rightDigest);
  }

  // Standard WebCrypto has no direct constant-time equality primitive. HMAC
  // verification delegates the fixed-length comparison to the native crypto
  // implementation without an early JavaScript plaintext equality branch.
  const comparisonKeyBytes = new Uint8Array(32);
  crypto.getRandomValues(comparisonKeyBytes);
  const comparisonKey = await crypto.subtle.importKey(
    "raw",
    comparisonKeyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const leftSignature = await crypto.subtle.sign(
    "HMAC",
    comparisonKey,
    leftDigest
  );
  return crypto.subtle.verify(
    "HMAC",
    comparisonKey,
    leftSignature,
    rightDigest
  );
}
