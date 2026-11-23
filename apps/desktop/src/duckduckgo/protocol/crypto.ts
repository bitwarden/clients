import * as forge from "node-forge";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SdkRandomNumberClient } from "@bitwarden/sdk-internal";

/** Bytes in a session key: 32 for AES-256 followed by 32 for HMAC-SHA256. */
const SESSION_KEY_BYTES = 64;
const SESSION_KEY_HALF = SESSION_KEY_BYTES / 2;

/**
 * The symmetric transport key for the encrypted channel between DuckDuckGo and Bitwarden desktop.
 *
 * Two keys in one buffer: the first half encrypts, the second half authenticates.
 */
export class DDGSessionKey {
  private constructor(private readonly bytes: Uint8Array) {}

  /** Generates a new session key. Requires the SDK to be loaded (`SdkLoadService.Ready`). */
  static generate(): DDGSessionKey {
    return DDGSessionKey.fromBytes(new SdkRandomNumberClient().gen_bytes(SESSION_KEY_BYTES));
  }

  /** Restores a key, e.g. the one secure storage kept from a previous run. */
  static fromBase64(base64: string): DDGSessionKey {
    return DDGSessionKey.fromBytes(Utils.fromB64ToArray(base64));
  }

  static fromBytes(bytes: Uint8Array): DDGSessionKey {
    if (bytes.length !== SESSION_KEY_BYTES) {
      throw new Error(`A session key is ${SESSION_KEY_BYTES} bytes, got ${bytes.length}.`);
    }

    return new DDGSessionKey(bytes);
  }

  /** The AES-256 half. */
  get encryption(): Uint8Array {
    return this.bytes.subarray(0, SESSION_KEY_HALF);
  }

  /** The HMAC-SHA256 half. */
  get authentication(): Uint8Array {
    return this.bytes.subarray(SESSION_KEY_HALF);
  }

  /** The whole buffer, for wrapping and for storage. */
  toBytes(): Uint8Array {
    return this.bytes;
  }

  toBase64(): string {
    return Utils.fromBufferToB64(this.bytes);
  }
}

/**
 * The initiator's ephemeral RSA public key, sent base64 SPKI in the handshake.
 *
 * DuckDuckGo generates a fresh pair per handshake. Nothing is pinned to it, so any peer
 * presenting a key can replace an existing pairing.
 */
export class DDGEphemeralPublicKey {
  private constructor(private readonly key: forge.pki.rsa.PublicKey) {}

  static fromBase64Spki(base64: string): DDGEphemeralPublicKey {
    const der = forge.util.createBuffer(Utils.fromB64ToArray(base64));
    return new DDGEphemeralPublicKey(
      forge.pki.publicKeyFromAsn1(forge.asn1.fromDer(der)) as forge.pki.rsa.PublicKey,
    );
  }

  static fromForgeKey(key: forge.pki.rsa.PublicKey): DDGEphemeralPublicKey {
    return new DDGEphemeralPublicKey(key);
  }

  /** Base64 SPKI, the form it travels in. */
  toBase64Spki(): string {
    const der = forge.asn1.toDer(forge.pki.publicKeyToAsn1(this.key)).getBytes();
    return Utils.fromBufferToB64(Utils.fromByteStringToArray(der));
  }

  /** Wraps a session key with RSA-OAEP-SHA1, the scheme DuckDuckGo expects. */
  wrapSessionKey(sessionKey: DDGSessionKey): string {
    const wrapped = this.key.encrypt(
      Utils.fromArrayToByteString(sessionKey.toBytes()) as string,
      "RSA-OAEP",
      { md: forge.md.sha1.create() },
    );
    return Utils.fromBufferToB64(Utils.fromByteStringToArray(wrapped));
  }
}

/**
 * The private half of the initiator's ephemeral pair. It never leaves the initiator, and unwraps
 * the session key the responder returns.
 */
export class DDGEphemeralPrivateKey {
  private constructor(private readonly key: forge.pki.rsa.PrivateKey) {}

  /** Generates a pair, as the initiator does at the start of every handshake. */
  static generatePair(bits = 2048): {
    publicKey: DDGEphemeralPublicKey;
    privateKey: DDGEphemeralPrivateKey;
  } {
    const pair = forge.pki.rsa.generateKeyPair({ bits });
    return {
      publicKey: DDGEphemeralPublicKey.fromForgeKey(pair.publicKey),
      privateKey: new DDGEphemeralPrivateKey(pair.privateKey),
    };
  }

  unwrapSessionKey(wrapped: string): DDGSessionKey {
    const bytes = this.key.decrypt(
      Utils.fromArrayToByteString(Utils.fromB64ToArray(wrapped)) as string,
      "RSA-OAEP",
      { md: forge.md.sha1.create() },
    );
    return DDGSessionKey.fromBytes(Utils.fromByteStringToArray(bytes));
  }
}

/**
 * How the final block is filled to the AES block size.
 *
 * The two directions differ: DuckDuckGo encrypts with {@link Zero}, Bitwarden answers with
 * {@link Pkcs7}.
 */
export const Padding = Object.freeze({
  /** PKCS#7, as Bitwarden uses everywhere else. Every padding byte states how many there are. */
  Pkcs7: "pkcs7",
  /**
   * The final block is filled with NUL, which is what DuckDuckGo sends. The length is not
   * recorded, so decrypting strips every trailing NUL; a plaintext that ends in NUL is truncated.
   *
   * DuckDuckGo is more tolerant in the other direction: it strips every trailing non-printable
   * byte, so it accepts a PKCS#7-padded reply as readily as a zero-padded one.
   *
   * ref: https://github.com/duckduckgo/apple-browsers/blob/04d678b447869c3a640714718a466b36407db8b6/macOS/DuckDuckGo/PasswordManager/Bitwarden/Services/BWEncryption.m#L141
   */
  Zero: "zero",
} as const);
export type Padding = (typeof Padding)[keyof typeof Padding];

/** Bitwarden's type-2 encstring, the envelope both directions use. */
const ENCSTRING_TYPE = "2";
const ENCSTRING_TYPE_NUMBER = 2;
const IV_BYTES = 16;
const AES_BLOCK_BYTES = 16;

/**
 * forge's `finish` takes a pad hook: returning false suppresses padding, true accepts the block
 * as-is. `@types/node-forge` declares `finish()` as taking nothing, so the call goes through this.
 */
type PadHook = (blockSize: number, buffer: unknown, decrypt: boolean) => boolean;
type CipherWithPadHook = { finish(pad?: PadHook): boolean };

function finishWith(cipher: forge.cipher.BlockCipher, pad?: PadHook): boolean {
  return (cipher as unknown as CipherWithPadHook).finish(pad);
}

/**
 * An outbound encstring on the wire: Bitwarden's `EncString` serialized as JSON, which repeats
 * the whole string and its parts. The peer passes this object to `EncryptService.decryptString`
 * and rejects a bare string, so every field is required.
 */
export type DDGEncstringPayload = {
  encryptedString: string;
  encryptionType: typeof ENCSTRING_TYPE_NUMBER;
  iv: string;
  data: string;
  mac: string;
};

/** Splits an encrypted encstring into the object form the wire carries. */
export function toWire(encstring: string): DDGEncstringPayload {
  const [iv, data, mac] = encstring.slice(`${ENCSTRING_TYPE}.`.length).split("|");

  return { encryptedString: encstring, encryptionType: ENCSTRING_TYPE_NUMBER, iv, data, mac };
}

/** Raised when a message cannot be decrypted: a bad MAC, a malformed envelope, bad padding. */
export class DDGDecryptError extends Error {}

/**
 * Encrypts `plaintext` into a `2.<iv>|<data>|<mac>` encstring.
 *
 * AES-256-CBC with a random IV, then HMAC-SHA256 over `iv ‖ ciphertext`.
 */
export function encrypt(plaintext: string, key: DDGSessionKey, padding: Padding): string {
  const iv = forge.random.getBytesSync(IV_BYTES);

  const cipher = forge.cipher.createCipher(
    "AES-CBC",
    Utils.fromArrayToByteString(key.encryption) as string,
  );
  cipher.start({ iv });

  const body = forge.util.encodeUtf8(plaintext);
  if (padding === Padding.Pkcs7) {
    cipher.update(forge.util.createBuffer(body));
    cipher.finish();
  } else {
    // forge only knows PKCS#7, so the NULs are added here and its own padding suppressed. A
    // plaintext already on a block boundary gains nothing, where PKCS#7 would add a whole block.
    cipher.update(forge.util.createBuffer(body + "\0".repeat(nulsNeeded(body.length))));
    finishWith(cipher, () => false);
  }
  const data = cipher.output.getBytes();

  const mac = calculateMac(iv + data, key);
  return [
    `${ENCSTRING_TYPE}.${Utils.fromBufferToB64(Utils.fromByteStringToArray(iv))}`,
    Utils.fromBufferToB64(Utils.fromByteStringToArray(data)),
    Utils.fromBufferToB64(Utils.fromByteStringToArray(mac)),
  ].join("|");
}

/**
 * Decrypts a `2.<iv>|<data>|<mac>` encstring, verifying the MAC before decrypting.
 *
 * @throws DDGDecryptError if the envelope is malformed, the MAC does not match, or the ciphertext
 * does not decrypt.
 */
export function decrypt(encstring: string, key: DDGSessionKey, padding: Padding): string {
  const [iv, data, mac] = parse(encstring);

  if (!equalsConstantTime(mac, calculateMac(iv + data, key))) {
    throw new DDGDecryptError("MAC verification failed.");
  }

  const decipher = forge.cipher.createDecipher(
    "AES-CBC",
    Utils.fromArrayToByteString(key.encryption) as string,
  );
  decipher.start({ iv });
  decipher.update(forge.util.createBuffer(data));

  // forge's unpad is suppressed for everything but PKCS#7: it reads the final byte as a count and
  // truncates that many without checking the rest. A zero-padded plaintext that fills its last
  // block and ends in "0" (0x30 = 48) would lose 48 bytes and report success.
  const skipUnpad: PadHook | undefined = padding === Padding.Pkcs7 ? undefined : () => true;
  if (!finishWith(decipher, skipUnpad)) {
    throw new DDGDecryptError("Decryption failed.");
  }

  const body = decipher.output.getBytes();
  return forge.util.decodeUtf8(padding === Padding.Zero ? stripTrailingNuls(body) : body);
}

function parse(encstring: string): [iv: string, data: string, mac: string] {
  const [type, rest] = splitOnce(encstring, ".");
  if (type !== ENCSTRING_TYPE || rest == null) {
    throw new DDGDecryptError(`Not a type-${ENCSTRING_TYPE} encstring.`);
  }

  const parts = rest.split("|");
  if (parts.length !== 3) {
    throw new DDGDecryptError("An encstring is iv|data|mac.");
  }

  const [iv, data, mac] = parts.map(
    (part) => Utils.fromArrayToByteString(Utils.fromB64ToArray(part)) as string,
  );
  if (iv.length !== IV_BYTES) {
    throw new DDGDecryptError(`An IV is ${IV_BYTES} bytes.`);
  }

  return [iv, data, mac];
}

function splitOnce(value: string, separator: string): [string, string | undefined] {
  const at = value.indexOf(separator);
  return at === -1 ? [value, undefined] : [value.slice(0, at), value.slice(at + 1)];
}

function calculateMac(contents: string, key: DDGSessionKey): string {
  const hmac = forge.hmac.create();
  hmac.start("sha256", Utils.fromArrayToByteString(key.authentication) as string);
  hmac.update(contents);
  return hmac.digest().getBytes();
}

/** NULs needed to reach the next block boundary; zero when already on one. */
function nulsNeeded(length: number): number {
  return (AES_BLOCK_BYTES - (length % AES_BLOCK_BYTES)) % AES_BLOCK_BYTES;
}

function stripTrailingNuls(bytes: string): string {
  let end = bytes.length;
  while (end > 0 && bytes.charCodeAt(end - 1) === 0) {
    end--;
  }
  return bytes.slice(0, end);
}

/**
 * Compares two MACs by comparing HMACs of them under a random key, so the comparison does not
 * reveal where they differ.
 *
 * ref: https://paragonie.com/blog/2015/11/preventing-timing-attacks-on-string-comparison-with-double-hmac-strategy
 */
function equalsConstantTime(a: string, b: string): boolean {
  const random = forge.random.getBytesSync(32);

  const of = (value: string) => {
    const hmac = forge.hmac.create();
    hmac.start("sha256", random);
    hmac.update(value);
    return hmac.digest().getBytes();
  };

  return of(a) === of(b);
}
