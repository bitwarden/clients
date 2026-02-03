import * as forge from "node-forge";

import { RecordKeyType } from "./generated/record";

const AES_GCM_NONCE_SIZE = 12;
const AES_GCM_TAG_SIZE = 16;
const AES_BLOCK_SIZE = 16;

export async function getRandomBytes(length: number): Promise<Uint8Array> {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

export async function generateEncryptionKey(): Promise<Uint8Array> {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const rawKey = await crypto.subtle.exportKey("raw", key);
  return new Uint8Array(rawKey);
}

export async function generateUid(): Promise<string> {
  const uid = await getRandomBytes(16);
  if ((uid[0] & 0xf8) === 0xf8) {
    uid[0] = uid[0] & 0x7f;
  }
  return base64UrlEncode(uid);
}

export async function encryptAesV1(
  data: Uint8Array,
  key: Uint8Array,
  iv?: Uint8Array,
): Promise<Uint8Array> {
  const ivBuffer = iv || (await getRandomBytes(AES_BLOCK_SIZE));
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, [
    "encrypt",
  ]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-CBC", iv: ivBuffer }, cryptoKey, data);
  return concatUint8Arrays(ivBuffer, new Uint8Array(encrypted));
}

export async function decryptAesV1(data: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  const iv = data.subarray(0, AES_BLOCK_SIZE);
  const encrypted = data.subarray(AES_BLOCK_SIZE);
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, [
    "decrypt",
  ]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-CBC", iv: iv }, cryptoKey, encrypted);
  return new Uint8Array(decrypted);
}

export async function encryptAesV2(
  data: Uint8Array,
  key: Uint8Array,
  nonce?: Uint8Array,
  nonceLength = AES_GCM_NONCE_SIZE,
): Promise<Uint8Array> {
  const nonceBuffer = nonce || (await getRandomBytes(nonceLength));
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-GCM" }, false, [
    "encrypt",
  ]);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonceBuffer, tagLength: AES_GCM_TAG_SIZE * 8 },
    cryptoKey,
    data,
  );
  return concatUint8Arrays(nonceBuffer, new Uint8Array(encrypted));
}

export async function decryptAesV2(
  data: Uint8Array,
  key: Uint8Array,
  nonceLength = AES_GCM_NONCE_SIZE,
): Promise<Uint8Array> {
  const nonce = data.subarray(0, nonceLength);
  // Web Crypto API expects ciphertext + tag together (not separated like Node.js)
  const ciphertextWithTag = data.subarray(nonceLength);
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-GCM" }, false, [
    "decrypt",
  ]);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce, tagLength: AES_GCM_TAG_SIZE * 8 },
    cryptoKey,
    ciphertextWithTag,
  );
  return new Uint8Array(decrypted);
}

export async function encryptRsa(
  data: Uint8Array,
  publicKeyBytes: Uint8Array,
): Promise<Uint8Array> {
  // Use node-forge for RSA PKCS#1 v1.5 padding (required by Keeper)
  // Web Crypto API doesn't support PKCS#1 v1.5 for encryption
  const publicKeyDer = forge.util.createBuffer(uint8ArrayToByteString(publicKeyBytes));
  const asn1 = forge.asn1.fromDer(publicKeyDer);
  const publicKey = forge.pki.publicKeyFromAsn1(asn1);

  const dataBytes = uint8ArrayToByteString(data);
  const encrypted = publicKey.encrypt(dataBytes, "RSAES-PKCS1-V1_5");
  return byteStringToUint8Array(encrypted);
}

export async function decryptRsa(
  data: Uint8Array,
  privateKeyBytes: Uint8Array,
): Promise<Uint8Array> {
  // Use node-forge for RSA PKCS#1 v1.5 padding
  const privateKeyDer = forge.util.createBuffer(uint8ArrayToByteString(privateKeyBytes));
  const asn1 = forge.asn1.fromDer(privateKeyDer);
  const privateKey = forge.pki.privateKeyFromAsn1(asn1);

  const dataBytes = uint8ArrayToByteString(data);
  const decrypted = privateKey.decrypt(dataBytes, "RSAES-PKCS1-V1_5");
  return byteStringToUint8Array(decrypted);
}

export async function generateEcKey(): Promise<{ privateKey: CryptoKey; publicKey: CryptoKey }> {
  const keyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  return { privateKey: keyPair.privateKey, publicKey: keyPair.publicKey };
}

export async function unloadEcPrivateKey(privateKey: CryptoKey): Promise<Uint8Array> {
  const exported = await crypto.subtle.exportKey("pkcs8", privateKey);
  return new Uint8Array(exported);
}

export async function unloadEcPublicKey(publicKey: CryptoKey): Promise<Uint8Array> {
  const exported = await crypto.subtle.exportKey("raw", publicKey);
  return new Uint8Array(exported);
}

export async function loadEcPublicKey(publicKeyBytes: Uint8Array): Promise<CryptoKey> {
  if (publicKeyBytes.length < 65 || publicKeyBytes[0] !== 0x04) {
    throw new Error("Invalid EC public key data");
  }
  return await crypto.subtle.importKey(
    "raw",
    publicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );
}

export async function loadEcPrivateKey(privateKeyBytes: Uint8Array): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
}

async function deriveEcdhKey(publicKey: CryptoKey, privateKey: CryptoKey): Promise<Uint8Array> {
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: publicKey },
    privateKey,
    256,
  );
  const hash = await crypto.subtle.digest("SHA-256", sharedSecret);
  return new Uint8Array(hash);
}

export async function encryptEc(data: Uint8Array, publicKey: CryptoKey): Promise<Uint8Array> {
  const { privateKey: ephemeralPrivate, publicKey: ephemeralPublic } = await generateEcKey();
  const encryptionKey = await deriveEcdhKey(publicKey, ephemeralPrivate);
  const encryptedData = await encryptAesV2(data, encryptionKey);
  const ephemeralPublicBytes = await unloadEcPublicKey(ephemeralPublic);
  return concatUint8Arrays(ephemeralPublicBytes, encryptedData);
}

export async function decryptEc(data: Uint8Array, privateKey: CryptoKey): Promise<Uint8Array> {
  const ephemeralPublicBytes = data.subarray(0, 65);
  const ephemeralPublic = await loadEcPublicKey(ephemeralPublicBytes);
  const encryptionKey = await deriveEcdhKey(ephemeralPublic, privateKey);
  const encryptedData = data.subarray(65);
  return await decryptAesV2(encryptedData, encryptionKey);
}

export async function deriveKeyV1(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: iterations,
      hash: "SHA-256",
    },
    passwordKey,
    256,
  );
  return new Uint8Array(derivedBits);
}

export async function deriveV1KeyHash(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await deriveKeyV1(password, salt, iterations);
  const hash = await crypto.subtle.digest("SHA-256", key);
  return new Uint8Array(hash);
}

export async function decryptEncryptionParams(
  password: string,
  encryptionParams: Uint8Array,
): Promise<Uint8Array> {
  const CORRUPTED_MESSAGE = "Corrupted encryption parameters";

  if (encryptionParams[0] !== 1) {
    throw new Error(CORRUPTED_MESSAGE);
  }

  if (encryptionParams.length !== 1 + 3 + 16 + 16 + 64) {
    throw new Error(CORRUPTED_MESSAGE);
  }

  const iterations = (encryptionParams[1] << 16) + (encryptionParams[2] << 8) + encryptionParams[3];
  const salt = encryptionParams.subarray(4, 20);
  const key = await deriveKeyV1(password, salt, iterations);
  const iv = encryptionParams.subarray(20, 36);

  // Decrypt data with no padding
  // We need to manually handle this since Web Crypto always expects PKCS7 padding
  const encryptedData = encryptionParams.subarray(36);
  const decrypted = await decryptAesNoPadding(encryptedData, key, iv);

  const first32 = decrypted.subarray(0, 32);
  const second32 = decrypted.subarray(32, 64);
  if (!uint8ArrayEquals(first32, second32)) {
    throw new Error(CORRUPTED_MESSAGE);
  }

  return first32;
}

async function decryptAesNoPadding(
  data: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
): Promise<Uint8Array> {
  // Web Crypto doesn't support no-padding mode, so we need a workaround.
  // We encrypt a PKCS7 padding block and append it to get valid padded ciphertext.
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, [
    "encrypt",
    "decrypt",
  ]);

  // Get the last block of ciphertext to use as IV for encrypting the padding
  const lastBlock = data.subarray(data.length - AES_BLOCK_SIZE);

  // Create a proper PKCS7 padding block (16 bytes of 0x10)
  const paddingBlock = new Uint8Array(AES_BLOCK_SIZE).fill(AES_BLOCK_SIZE);

  // Encrypt the padding block using the last ciphertext block as IV
  const encryptedPadding = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv: lastBlock },
    cryptoKey,
    paddingBlock,
  );

  // Take only the first block of the encrypted padding (the second block is the padding of the padding)
  const encryptedPaddingBlock = new Uint8Array(encryptedPadding).subarray(0, AES_BLOCK_SIZE);

  // Append the encrypted padding to the original ciphertext
  const paddedCiphertext = concatUint8Arrays(data, encryptedPaddingBlock);

  // Now decrypt - Web Crypto will find valid PKCS7 padding
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv: iv },
    cryptoKey,
    paddedCiphertext,
  );

  // Return only the original data length (strip the decrypted padding block)
  return new Uint8Array(decrypted).subarray(0, data.length);
}

export async function decryptKeeperKey(
  encryptedKey: Uint8Array,
  keyType: RecordKeyType,
  dataKey: Uint8Array,
  rsaPrivateKey?: Uint8Array,
  ecPrivateKey?: CryptoKey,
): Promise<Uint8Array> {
  switch (keyType) {
    case RecordKeyType.NO_KEY:
      throw new Error("Cannot decrypt NO_KEY type");

    case RecordKeyType.ENCRYPTED_BY_DATA_KEY:
      return await decryptAesV1(encryptedKey, dataKey);

    case RecordKeyType.ENCRYPTED_BY_PUBLIC_KEY:
      if (!rsaPrivateKey) {
        throw new Error("RSA private key required for ENCRYPTED_BY_PUBLIC_KEY");
      }
      return await decryptRsa(encryptedKey, rsaPrivateKey);

    case RecordKeyType.ENCRYPTED_BY_DATA_KEY_GCM:
      return await decryptAesV2(encryptedKey, dataKey);

    case RecordKeyType.ENCRYPTED_BY_PUBLIC_KEY_ECC:
      if (!ecPrivateKey) {
        throw new Error("EC private key required for ENCRYPTED_BY_PUBLIC_KEY_ECC");
      }
      return await decryptEc(encryptedKey, ecPrivateKey);

    default:
      throw new Error(`Unknown key type: ${keyType}`);
  }
}

export async function decryptRecordData(
  encryptedData: Uint8Array,
  recordKey: Uint8Array,
  version: number,
): Promise<unknown> {
  const decrypted =
    version >= 3
      ? await decryptAesV2(encryptedData, recordKey)
      : await decryptAesV1(encryptedData, recordKey);

  try {
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch (error) {
    throw new Error(`Failed to parse record data: ${error}`);
  }
}

export async function decryptFolderData(
  encryptedData: Uint8Array,
  folderKey: Uint8Array,
): Promise<unknown> {
  const decrypted = await decryptAesV1(encryptedData, folderKey);

  try {
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch (error) {
    throw new Error(`Failed to parse folder data: ${error}`);
  }
}

// Base64 URL encoding/decoding

export function base64UrlEncode(data: Uint8Array): string {
  // Convert to base64
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  const base64 = btoa(binary);
  // Convert to base64url
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(text: string): Uint8Array {
  if (!text) {
    return new Uint8Array(0);
  }

  const base64 = text
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .replace(/=/g, "")
    .replace(/\r/g, "")
    .replace(/\n/g, "");

  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return new Uint8Array(0);
  }
}

// Helper functions

function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function uint8ArrayEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function uint8ArrayToByteString(data: Uint8Array): string {
  let result = "";
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(data[i]);
  }
  return result;
}

function byteStringToUint8Array(str: string): Uint8Array {
  const result = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    result[i] = str.charCodeAt(i);
  }
  return result;
}
