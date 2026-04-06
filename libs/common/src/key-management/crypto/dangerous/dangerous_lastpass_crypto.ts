import forge from "node-forge";

import { Utils } from "../../../platform/misc/utils";

/**
 * Decrypts data using AES-ECB with the given key.
 * This is used for decrypting LastPass imports, which use AES-ECB without an IV.
 * ECB is extremely dangerous: https://words.filippo.io/the-ecb-penguin/
 *
 * ⚠️️ HAZMAT WARNING ⚠️️: AES-ECB is not a secure encryption mode and allows both tampering and
 * leaks large amounts of information. DO NOT USE THIS FOR ANYTHING ELSE THAN DECRYPTING LASTPASS
 * IMPORTS.
 */
export function DANGEROUS_aesEcbDecryptLastpassImport(
  data: Uint8Array,
  key: Uint8Array,
): Uint8Array<ArrayBuffer> {
  const decryptor = forge.cipher.createDecipher(
    "AES-ECB",
    Utils.fromArrayToByteString(key) as string,
  );
  decryptor.start();
  decryptor.update(forge.util.createBuffer(Utils.fromArrayToByteString(data) as string));

  if (!decryptor.finish()) {
    throw new Error("AES-ECB decryption failed.");
  }

  return Utils.fromByteStringToArray(decryptor.output.getBytes());
}

/**
 * Decrypts data using AES-CBC with the given key and IV.
 * This is used for decrypting LastPass imports, which use AES-CBC with a separate IV. No
 * MAC is performed, and this is vulnerable to tampering (xor malleability).
 *
 * ⚠️️ HAZMAT WARNING ⚠️️: AES-CBC without proper authentication allows tampering and should not be used
 * for new designs. DO NOT USE THIS FOR ANYTHING ELSE THAN DECRYPTING LASTPASS IMPORTS.
 */
export function DANGEROUS_aesCbcDecryptLastpassImport(
  data: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
): Uint8Array<ArrayBuffer> {
  const decryptor = forge.cipher.createDecipher(
    "AES-CBC",
    Utils.fromArrayToByteString(key) as string,
  );
  decryptor.start({ iv: Utils.fromArrayToByteString(iv) as string });
  decryptor.update(forge.util.createBuffer(Utils.fromArrayToByteString(data) as string));
  if (!decryptor.finish()) {
    throw new Error("AES-CBC decryption failed.");
  }

  return Utils.fromByteStringToArray(decryptor.output.getBytes());
}
