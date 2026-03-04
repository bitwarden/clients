import * as forge from "node-forge";

import { Utils } from "../../../platform/misc/utils";
import { Aes256CbcHmacKey } from "../../../platform/models/domain/symmetric-crypto-key";

/**
 * Aes256CbcHmac, but without correct PKCS#7 padding. Forces us to guess padding
 */
export type DuckDuckGoEncstring = string;

/**
 * Decrypts a DuckDuckGo encstring, which is in the format of 2.B64IV|B64DATA|B64MAC, using AES-256-CBC for encryption and HMAC-SHA256 for authentication.
 * Note that this implementation does not use PKCS#7 padding, and the last CBC block is filled up with zeroes when decrypting, leading us to guess where
 * the contents end.
 */
export function DANGEROUS_aesDecryptDuckDuckGoNoPaddingAes256CbcHmac(
  encstring: DuckDuckGoEncstring,
  key: Aes256CbcHmacKey,
): Uint8Array {
  // Parse the encstring
  const [, rest] = encstring.split(".", 2);
  const [ivB64, dataB64, macB64] = rest.split("|", 3);
  const [iv, data, mac] = [ivB64, dataB64, macB64].map((part) => Utils.fromB64ToArray(part));

  // Calculate the MAC and compare it. If the mac does not match, throw an error.
  // Note: The mac is over both IV and data
  const hmac = forge.hmac.create();
  hmac.start("sha256", Utils.fromArrayToByteString(key.authenticationKey)!);
  hmac.update(Utils.fromArrayToByteString(concatUint8Arrays(iv, data)));
  const expectedMac = Utils.fromByteStringToArray(hmac.digest().getBytes());
  if (!compareConstantTime(mac, expectedMac)) {
    throw new Error("MAC verification failed.");
  }

  // Decrypt the data
  const decryptor = forge.cipher.createDecipher(
    "AES-CBC",
    Utils.fromArrayToByteString(key.encryptionKey) as string,
  );
  decryptor.start({ iv: Utils.fromArrayToByteString(iv) as string });
  decryptor.update(forge.util.createBuffer(Utils.fromArrayToByteString(data) as string));
  if (!decryptor.finish()) {
    throw new Error("Decryption failed.");
  }

  // PKCS#7 padding is not used. Therefore, the plaintext will look something like:
  // [DATA][DATA][DATA][PARTIAL], where data are full 16-byte blocks, and partial is the last
  // block, that contains up to 16 null bytes, along with a prefix of data, i.e:
  // [PARTIAL] = [1,2,3,4,5,0,0,0,0,0,0,0,0,0,0,0] (if the last block has 5 bytes of data)
  // We have to remove the trailing null bytes here.
  const decryptedBytes = Utils.fromByteStringToArray(decryptor.output.getBytes());
  let endIndex = decryptedBytes.length;
  while (endIndex > 0 && decryptedBytes[endIndex - 1] === 0) {
    endIndex--;
  }

  return decryptedBytes.slice(0, endIndex);
}

// Safely compare two values in a way that protects against timing attacks (Double HMAC Verification).
// ref: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2011/february/double-hmac-verification/
// ref: https://paragonie.com/blog/2015/11/preventing-timing-attacks-on-string-comparison-with-double-hmac-strategy
function compareConstantTime(a: Uint8Array, b: Uint8Array): boolean {
  const rand = self.crypto.getRandomValues(new Uint8Array(32));

  const hmac = forge.hmac.create();
  hmac.start("sha256", Utils.fromArrayToByteString(rand));
  hmac.update(Utils.fromArrayToByteString(a));
  const mac1 = hmac.digest().getBytes();

  hmac.start("sha256", Utils.fromArrayToByteString(rand));
  hmac.update(Utils.fromArrayToByteString(b));
  const mac2 = hmac.digest().getBytes();

  const equals = mac1 === mac2;
  return equals;
}

function concatUint8Arrays(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}
