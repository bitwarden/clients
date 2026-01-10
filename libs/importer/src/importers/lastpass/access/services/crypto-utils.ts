import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

export class CryptoUtils {
  constructor(private cryptoFunctionService: CryptoFunctionService) {}

  async deriveKey(username: string, password: string, iterationCount: number) {
    if (iterationCount < 0) {
      throw new Error("Iteration count should be positive");
    }
    if (iterationCount == 1) {
      return await this.cryptoFunctionService.hash(username + password, "sha256");
    }
    return await this.cryptoFunctionService.pbkdf2(password, username, "sha256", iterationCount);
  }

  async deriveKeyHash(username: string, password: string, iterationCount: number) {
    const key = await this.deriveKey(username, password, iterationCount);
    if (iterationCount == 1) {
      return await this.cryptoFunctionService.hash(
        Utils.fromBufferToHex(key.buffer) + password,
        "sha256",
      );
    }
    return await this.cryptoFunctionService.pbkdf2(key, password, "sha256", 1);
  }

  ExclusiveOr(arr1: Uint8Array, arr2: Uint8Array) {
    if (arr1.length !== arr2.length) {
      throw new Error("Arrays must be the same length.");
    }
    const result = new Uint8Array(arr1.length);
    for (let i = 0; i < arr1.length; i++) {
      result[i] = arr1[i] ^ arr2[i];
    }
    return result;
  }

  async decryptAes256PlainWithDefault(
    data: Uint8Array,
    encryptionKey: Uint8Array,
    defaultValue: string,
  ) {
    try {
      return this.decryptAes256Plain(data, encryptionKey);
    } catch {
      return defaultValue;
    }
  }

  async decryptAes256Base64WithDefault(
    data: Uint8Array,
    encryptionKey: Uint8Array,
    defaultValue: string,
  ) {
    try {
      return this.decryptAes256Base64(data, encryptionKey);
    } catch {
      return defaultValue;
    }
  }

  async decryptAes256Plain(data: Uint8Array, encryptionKey: Uint8Array) {
    if (data.length === 0) {
      return "";
    }
    // Byte 33 == character '!'
    if (data[0] === 33 && data.length % 16 === 1 && data.length > 32) {
      return this.decryptAes256CbcPlain(data, encryptionKey);
    }
    return this.decryptAes256EcbPlain(data, encryptionKey);
  }

  async decryptAes256Base64(data: Uint8Array, encryptionKey: Uint8Array) {
    if (data.length === 0) {
      return "";
    }
    // Byte 33 == character '!'
    if (data[0] === 33) {
      return this.decryptAes256CbcBase64(data, encryptionKey);
    }
    return this.decryptAes256EcbBase64(data, encryptionKey);
  }

  async decryptAes256(
    data: Uint8Array,
    encryptionKey: Uint8Array,
    mode: "cbc" | "ecb",
    iv: Uint8Array = new Uint8Array(16),
  ): Promise<string> {
    if (data.length === 0) {
      return "";
    }
    const plain = await this.cryptoFunctionService.aesDecrypt(data, iv, encryptionKey, mode);
    return Utils.fromBufferToUtf8(plain);
  }

  private async decryptAes256EcbPlain(data: Uint8Array, encryptionKey: Uint8Array) {
    return this.decryptAes256(data, encryptionKey, "ecb");
  }

  private async decryptAes256EcbBase64(data: Uint8Array, encryptionKey: Uint8Array) {
    const d = Utils.fromB64ToArray(Utils.fromBufferToUtf8(data));
    return this.decryptAes256(d, encryptionKey, "ecb");
  }

  private async decryptAes256CbcPlain(data: Uint8Array, encryptionKey: Uint8Array) {
    const d = data.subarray(17);
    const iv = data.subarray(1, 17);
    return this.decryptAes256(d, encryptionKey, "cbc", iv);
  }

  private async decryptAes256CbcBase64(data: Uint8Array, encryptionKey: Uint8Array) {
    const d = Utils.fromB64ToArray(Utils.fromBufferToUtf8(data.subarray(26)));
    const iv = Utils.fromB64ToArray(Utils.fromBufferToUtf8(data.subarray(1, 25)));
    return this.decryptAes256(d, encryptionKey, "cbc", iv);
  }
}
