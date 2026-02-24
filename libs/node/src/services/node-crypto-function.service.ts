import * as crypto from "crypto";

import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { UnsignedPublicKey } from "@bitwarden/common/key-management/types";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { EncryptionType } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  CbcDecryptParameters,
  EcbDecryptParameters,
} from "@bitwarden/common/platform/models/domain/decrypt-parameters";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { PureCrypto } from "@bitwarden/sdk-internal";

export class NodeCryptoFunctionService implements CryptoFunctionService {
  pbkdf2(
    password: string | Uint8Array,
    salt: string | Uint8Array,
    algorithm: "sha256" | "sha512",
    iterations: number,
  ): Promise<Uint8Array> {
    const len = algorithm === "sha256" ? 32 : 64;
    return new Promise<Uint8Array>((resolve, reject) => {
      crypto.pbkdf2(password, salt, iterations, len, algorithm, (error, key) => {
        if (error != null) {
          reject(error);
        } else {
          resolve(new Uint8Array(key));
        }
      });
    });
  }

  // ref: https://tools.ietf.org/html/rfc5869
  async hkdf(
    ikm: Uint8Array,
    salt: string | Uint8Array,
    info: string | Uint8Array,
    outputByteSize: number,
    algorithm: "sha256" | "sha512",
  ): Promise<Uint8Array> {
    const saltArr = typeof salt === "string" ? Utils.fromUtf8ToArray(salt) : salt;
    const prk = await this.hmac(ikm, saltArr, algorithm);
    return this.hkdfExpand(prk, info, outputByteSize, algorithm);
  }

  // ref: https://tools.ietf.org/html/rfc5869
  async hkdfExpand(
    prk: Uint8Array,
    info: string | Uint8Array,
    outputByteSize: number,
    algorithm: "sha256" | "sha512",
  ): Promise<Uint8Array> {
    const hashLen = algorithm === "sha256" ? 32 : 64;
    if (outputByteSize > 255 * hashLen) {
      throw new Error("outputByteSize is too large.");
    }
    const prkArr = new Uint8Array(prk);
    if (prkArr.length < hashLen) {
      throw new Error("prk is too small.");
    }
    const infoBuf = typeof info === "string" ? Utils.fromUtf8ToArray(info) : info;
    const infoArr = new Uint8Array(infoBuf);
    let runningOkmLength = 0;
    let previousT: Uint8Array<ArrayBuffer> = new Uint8Array(0);
    const n = Math.ceil(outputByteSize / hashLen);
    const okm = new Uint8Array(n * hashLen);
    for (let i = 0; i < n; i++) {
      const t = new Uint8Array(previousT.length + infoArr.length + 1);
      t.set(previousT);
      t.set(infoArr, previousT.length);
      t.set([i + 1], t.length - 1);
      previousT = (await this.hmac(t, prk, algorithm)) as Uint8Array<ArrayBuffer>;
      okm.set(previousT, runningOkmLength);
      runningOkmLength += previousT.length;
      if (runningOkmLength >= outputByteSize) {
        break;
      }
    }
    return okm.slice(0, outputByteSize);
  }

  hash(
    value: string | Uint8Array,
    algorithm: "sha1" | "sha256" | "sha512" | "md5",
  ): Promise<Uint8Array> {
    const hash = crypto.createHash(algorithm);
    hash.update(value);
    return Promise.resolve(new Uint8Array(hash.digest()));
  }

  hmac(
    value: Uint8Array,
    key: Uint8Array,
    algorithm: "sha1" | "sha256" | "sha512",
  ): Promise<Uint8Array> {
    const hmac = crypto.createHmac(algorithm, key);
    hmac.update(value);
    return Promise.resolve(new Uint8Array(hmac.digest()));
  }

  async compare(a: Uint8Array, b: Uint8Array): Promise<boolean> {
    const key = await this.randomBytes(32);
    const mac1 = await this.hmac(a, key, "sha256");
    const mac2 = await this.hmac(b, key, "sha256");
    if (mac1.byteLength !== mac2.byteLength) {
      return false;
    }

    const arr1 = new Uint8Array(mac1);
    const arr2 = new Uint8Array(mac2);
    for (let i = 0; i < arr2.length; i++) {
      if (arr1[i] !== arr2[i]) {
        return false;
      }
    }

    return true;
  }

  hmacFast(
    value: Uint8Array,
    key: Uint8Array,
    algorithm: "sha1" | "sha256" | "sha512",
  ): Promise<Uint8Array> {
    return this.hmac(value, key, algorithm);
  }

  compareFast(a: Uint8Array, b: Uint8Array): Promise<boolean> {
    return this.compare(a, b);
  }

  aesEncrypt(data: Uint8Array, iv: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    const encBuf = Buffer.concat([cipher.update(data), cipher.final()]);
    return Promise.resolve(new Uint8Array(encBuf));
  }

  aesDecryptFastParameters(
    data: string,
    iv: string,
    mac: string | null,
    key: SymmetricCryptoKey,
  ): CbcDecryptParameters<Uint8Array> {
    const dataBytes = Utils.fromB64ToArray(data);
    const ivBytes = Utils.fromB64ToArray(iv);
    const macBytes = mac != null ? Utils.fromB64ToArray(mac) : null;

    const innerKey = key.inner();

    if (innerKey.type === EncryptionType.AesCbc256_B64) {
      return {
        iv: ivBytes,
        data: dataBytes,
        encKey: innerKey.encryptionKey,
      } as CbcDecryptParameters<Uint8Array>;
    } else if (innerKey.type === EncryptionType.AesCbc256_HmacSha256_B64) {
      const macData = new Uint8Array(ivBytes.byteLength + dataBytes.byteLength);
      macData.set(new Uint8Array(ivBytes), 0);
      macData.set(new Uint8Array(dataBytes), ivBytes.byteLength);
      return {
        iv: ivBytes,
        data: dataBytes,
        mac: macBytes,
        macData: macData,
        encKey: innerKey.encryptionKey,
        macKey: innerKey.authenticationKey,
      } as CbcDecryptParameters<Uint8Array>;
    } else {
      throw new Error("Unsupported encryption type");
    }
  }

  async aesDecryptFast({
    mode,
    parameters,
  }:
    | { mode: "cbc"; parameters: CbcDecryptParameters<Uint8Array> }
    | { mode: "ecb"; parameters: EcbDecryptParameters<Uint8Array> }): Promise<string> {
    if (mode === "ecb") {
      /// WARNING: https://crypto.stackexchange.com/questions/20941/why-shouldnt-i-use-ecb-encryption
      return Utils.fromArrayToUtf8(
        (await this.aesDecrypt(
          parameters.data,
          null,
          parameters.encKey,
          "ecb",
        )) as Uint8Array<ArrayBuffer>,
      )!;
    } else if (mode === "cbc") {
      return Utils.fromArrayToUtf8(
        (await this.aesDecrypt(
          parameters.data,
          parameters.iv,
          parameters.encKey,
          "cbc",
        )) as Uint8Array<ArrayBuffer>,
      )!;
    } else {
      throw new Error("Unsupported mode");
    }
  }

  aesDecrypt(
    data: Uint8Array,
    iv: Uint8Array | null,
    key: Uint8Array,
    mode: "cbc" | "ecb",
  ): Promise<Uint8Array> {
    const decipher = crypto.createDecipheriv(this.toNodeCryptoAesMode(mode), key, iv);
    const decBuf = Buffer.concat([decipher.update(data), decipher.final()]);
    return Promise.resolve(new Uint8Array(decBuf));
  }

  async rsaEncrypt(
    data: Uint8Array,
    publicKey: Uint8Array,
    _algorithm: "sha1",
  ): Promise<Uint8Array> {
    await SdkLoadService.Ready;
    return PureCrypto.rsa_encrypt_data(data, publicKey);
  }

  async rsaDecrypt(
    data: Uint8Array,
    privateKey: Uint8Array,
    _algorithm: "sha1",
  ): Promise<Uint8Array> {
    await SdkLoadService.Ready;
    return PureCrypto.rsa_decrypt_data(data, privateKey);
  }

  async rsaExtractPublicKey(privateKey: Uint8Array): Promise<UnsignedPublicKey> {
    await SdkLoadService.Ready;
    return PureCrypto.rsa_extract_public_key(privateKey) as UnsignedPublicKey;
  }

  async rsaGenerateKeyPair(_length: 2048): Promise<[UnsignedPublicKey, Uint8Array]> {
    await SdkLoadService.Ready;
    const privateKey = PureCrypto.rsa_generate_keypair();
    const publicKey = await this.rsaExtractPublicKey(privateKey);
    return [publicKey, privateKey];
  }

  aesGenerateKey(bitLength: 128 | 192 | 256 | 512): Promise<CsprngArray> {
    return this.randomBytes(bitLength / 8);
  }

  randomBytes(length: number): Promise<CsprngArray> {
    return new Promise<CsprngArray>((resolve, reject) => {
      crypto.randomBytes(length, (error, bytes) => {
        if (error != null) {
          reject(error);
        } else {
          resolve(new Uint8Array(bytes) as CsprngArray);
        }
      });
    });
  }

  private toNodeCryptoAesMode(mode: "cbc" | "ecb"): string {
    return mode === "cbc" ? "aes-256-cbc" : "aes-256-ecb";
  }
}
