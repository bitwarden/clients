/**
 * Crypto utilities for PSK authentication using HKDF
 * Based on the Noise Protocol pairing implementation
 */

/**
 * Generate a random salt for PSK derivation
 * @returns 32-byte random salt
 */
export function generatePSKSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Derive a Pre-Shared Key (PSK) from password using HKDF with SHA-256
 *
 * @param password - The pairing password
 * @param salt - Random salt (32 bytes) to prevent rainbow table attacks
 * @returns 32-byte PSK for Noise protocol
 */
export async function derivePSKFromPassword(
  password: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  // Import password as key material
  const passwordBytes = new TextEncoder().encode(password);
  const keyMaterial = await crypto.subtle.importKey("raw", passwordBytes, { name: "HKDF" }, false, [
    "deriveBits",
  ]);

  // Info string for HKDF
  const info = new TextEncoder().encode("noise-pairing-psk-v1");

  // Derive 32-byte key using HKDF
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: salt,
      info: info,
    },
    keyMaterial,
    256, // 32 bytes * 8 bits
  );

  return new Uint8Array(derivedBits);
}

/**
 * Convert Uint8Array to base64 string (browser-compatible)
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.length;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array (browser-compatible)
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  if (!base64 || typeof base64 !== "string") {
    throw new Error("Invalid base64 input: must be a non-empty string");
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encode a pairing code that bundles password, salt, and username together
 *
 * Format: password:base64(JSON{salt, username})
 * Example: "K7X9:eyJzIjoiNG44d0YyLi4uIiwidSI6ImFuZGVycyJ9"
 *
 * @param password - The pairing password
 * @param salt - The PSK salt
 * @param username - The username to encode in the pairing code
 * @returns Combined pairing code string
 */
export function encodePairingCode(password: string, salt: Uint8Array, username: string): string {
  const saltBase64 = uint8ArrayToBase64(salt);
  const metadata = {
    s: saltBase64,
    u: username,
  };
  const metadataJson = JSON.stringify(metadata);
  const metadataBase64 = btoa(metadataJson);

  return `${password}:${metadataBase64}`;
}

/**
 * Decode a pairing code into password, salt, and username components
 *
 * @param pairingCode - The combined pairing code
 * @returns Object containing password, salt, and username
 * @throws Error if pairing code format is invalid
 */
export function decodePairingCode(pairingCode: string): {
  password: string;
  salt: Uint8Array;
  username: string;
} {
  const parts = pairingCode.split(":");

  if (parts.length !== 2) {
    throw new Error("Invalid pairing code format. Expected format: password:metadata");
  }

  const [password, metadataBase64] = parts;

  if (!password || password.length === 0) {
    throw new Error("Invalid pairing code: password is empty");
  }

  let metadata: { s: string; u: string };
  try {
    const metadataJson = atob(metadataBase64);
    metadata = JSON.parse(metadataJson);
  } catch {
    throw new Error("Invalid pairing code: metadata is not valid base64 JSON");
  }

  if (!metadata.s || !metadata.u) {
    throw new Error("Invalid pairing code: missing salt or username in metadata");
  }

  let salt: Uint8Array;
  try {
    salt = base64ToUint8Array(metadata.s);
  } catch {
    throw new Error("Invalid pairing code: salt is not valid base64");
  }

  if (salt.length !== 32) {
    throw new Error(`Invalid pairing code: salt must be 32 bytes, got ${salt.length}`);
  }

  return { password, salt, username: metadata.u };
}

/**
 * Generate a random pairing password (e.g., 4-character code)
 * @param length - Length of the password (default: 4)
 * @returns Random alphanumeric password
 */
export function generatePairingPassword(length: number = 4): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude ambiguous characters
  let password = "";
  const randomValues = crypto.getRandomValues(new Uint8Array(length));

  for (let i = 0; i < length; i++) {
    password += chars[randomValues[i] % chars.length];
  }

  return password;
}
