import { EncryptionType } from "../../../platform/enums";
import { Utils } from "../../../platform/misc/utils";
import { Aes256CbcHmacKey } from "../../../platform/models/domain/symmetric-crypto-key";

import { DANGEROUS_aesDecryptDuckDuckGoNoPaddingAes256CbcHmac } from "./dangerous_duckduckgo_crypto";

const KEY = new Uint8Array(32).fill(0); // 32 bytes key filled with 0x01
const IV = new Uint8Array(16).fill(0); // 16 bytes IV filled with 0x00
const PLAINTEXT = Utils.fromHexToArray("48656c6c6f20776f726c64"); // "Hello world" in hex
const CIPHERTEXT = Utils.fromHexToArray("ea3b4d756457b51bcc04570e6bcd455f");
const MAC = Utils.fromHexToArray(
  "b1c89cc2ab5af50e4bbe1599e1c07489bd4525f89eb81712d479c4112a7bbf62",
);

describe("DANGEROUS_aesDecryptDuckDuckGoNoPaddingAes256CbcHmac", () => {
  it("decrypts a valid DuckDuckGo 2.iv|data|mac encstring", async () => {
    const key: Aes256CbcHmacKey = {
      type: EncryptionType.AesCbc256_HmacSha256_B64,
      encryptionKey: KEY, // For test purposes, both sub-keys are the null key
      authenticationKey: KEY,
    };

    const decrypted = DANGEROUS_aesDecryptDuckDuckGoNoPaddingAes256CbcHmac(
      `2.${Utils.fromArrayToB64(IV)}|${Utils.fromArrayToB64(CIPHERTEXT)}|${Utils.fromArrayToB64(MAC)}`,
      key,
    );

    expect(decrypted).toEqual(PLAINTEXT);
  });

  it("throws when MAC verification fails", async () => {
    const key: Aes256CbcHmacKey = {
      type: EncryptionType.AesCbc256_HmacSha256_B64,
      encryptionKey: KEY,
      authenticationKey: KEY,
    };

    const invalidMac = new Uint8Array(MAC);
    invalidMac[0] ^= 0xff; // Corrupt the MAC

    expect(() =>
      DANGEROUS_aesDecryptDuckDuckGoNoPaddingAes256CbcHmac(
        `2.${Utils.fromArrayToB64(IV)}|${Utils.fromArrayToB64(CIPHERTEXT)}|${Utils.fromArrayToB64(invalidMac)}`,
        key,
      ),
    ).toThrow("MAC verification failed.");
  });
});
