import * as crypto from "crypto";

import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { UnsignedPublicKey } from "@bitwarden/common/key-management/types";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
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
      previousT = await this.hmac(t, prk, algorithm);
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

  private hmac(
    value: Uint8Array,
    key: Uint8Array,
    algorithm: "sha256" | "sha512",
  ): Promise<Uint8Array<ArrayBuffer>> {
    const hmac = crypto.createHmac(algorithm, key);
    hmac.update(value);
    return Promise.resolve(new Uint8Array(hmac.digest()));
  }
}
