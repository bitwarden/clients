import { Utils } from "../../../platform/misc/utils";

import { DANGEROUS_aesEcbDecryptLastpassImport } from "./dangerous_lastpass_crypto";

const CIPHERTEXT = Utils.fromB64ToArray("z5q2XSxYCdQFdI+qK2yLlw==");
const KEY = new Uint8Array([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26,
  27, 28, 29, 30, 31,
]);

describe("DANGEROUS_aesEcbDecryptLastpassImport", () => {
  it("decrypts AES-ECB payload used by LastPass imports", async () => {
    const decrypted = DANGEROUS_aesEcbDecryptLastpassImport(CIPHERTEXT, KEY);
    expect(Utils.fromArrayToUtf8(decrypted)).toBe("EncryptMe!");
  });

  it("throws when ciphertext is not a valid AES block payload", async () => {
    const invalidCiphertext = Utils.fromUtf8ToArray("short");
    expect(() => DANGEROUS_aesEcbDecryptLastpassImport(invalidCiphertext, KEY)).toThrow(
      "AES-ECB decryption failed.",
    );
  });
});
