import * as forge from "node-forge";

import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { PureCrypto } from "@bitwarden/sdk-internal";

import { Utils } from "../../../platform/misc/utils";
import { CsprngArray } from "../../../types/csprng";
import { UnsignedPublicKey } from "../../types";
import { CryptoFunctionService } from "../abstractions/crypto-function.service";

export class WebCryptoFunctionService implements CryptoFunctionService {
  private crypto: Crypto;
  private subtle: SubtleCrypto;

  constructor(globalContext: { crypto: Crypto }) {
    if (globalContext?.crypto?.subtle == null) {
      throw new Error(
        "Could not instantiate WebCryptoFunctionService. Could not locate Subtle crypto.",
      );
    }
    this.crypto = globalContext.crypto;
    this.subtle = this.crypto.subtle;
  }

  async pbkdf2(
    password: string | Uint8Array,
    salt: string | Uint8Array,
    algorithm: "sha256" | "sha512",
    iterations: number,
  ): Promise<Uint8Array> {
    const wcLen = algorithm === "sha256" ? 256 : 512;
    const passwordBuf = this.toBuf(password);
    const saltBuf = this.toBuf(salt);

    const pbkdf2Params: Pbkdf2Params = {
      name: "PBKDF2",
      salt: saltBuf,
      iterations: iterations,
      hash: { name: this.toWebCryptoAlgorithm(algorithm) },
    };

    const impKey = await this.subtle.importKey(
      "raw",
      passwordBuf,
      { name: "PBKDF2" } as any,
      false,
      ["deriveBits"],
    );
    const buffer = await this.subtle.deriveBits(pbkdf2Params as any, impKey, wcLen);
    return new Uint8Array(buffer);
  }

  async hkdf(
    ikm: Uint8Array,
    salt: string | Uint8Array,
    info: string | Uint8Array,
    outputByteSize: number,
    algorithm: "sha256" | "sha512",
  ): Promise<Uint8Array> {
    const saltBuf = this.toBuf(salt);
    const infoBuf = this.toBuf(info);

    const hkdfParams: HkdfParams = {
      name: "HKDF",
      salt: saltBuf,
      info: infoBuf,
      hash: { name: this.toWebCryptoAlgorithm(algorithm) },
    };

    const impKey = await this.subtle.importKey(
      "raw",
      this.toBuf(ikm),
      { name: "HKDF" } as any,
      false,
      ["deriveBits"],
    );
    const buffer = await this.subtle.deriveBits(hkdfParams as any, impKey, outputByteSize * 8);
    return new Uint8Array(buffer);
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
    const infoBuf = this.toBuf(info);
    const infoArr = new Uint8Array(infoBuf);
    let runningOkmLength = 0;
    let previousT = new Uint8Array(0);
    const n = Math.ceil(outputByteSize / hashLen);
    const okm = new Uint8Array(n * hashLen);
    for (let i = 0; i < n; i++) {
      const t = new Uint8Array(previousT.length + infoArr.length + 1);
      t.set(previousT);
      t.set(infoArr, previousT.length);
      t.set([i + 1], t.length - 1);
      previousT = new Uint8Array(await this.hmac(t, prk, algorithm));
      okm.set(previousT, runningOkmLength);
      runningOkmLength += previousT.length;
      if (runningOkmLength >= outputByteSize) {
        break;
      }
    }
    return okm.slice(0, outputByteSize);
  }

  async hash(
    value: string | Uint8Array,
    algorithm: "sha1" | "sha256" | "sha512" | "md5",
  ): Promise<Uint8Array> {
    if (algorithm === "md5") {
      const md = forge.md.md5.create();
      const valueBytes = this.toByteString(value);
      md.update(valueBytes, "raw");
      return Utils.fromByteStringToArray(md.digest().data);
    }

    const valueBuf = this.toBuf(value);
    const buffer = await this.subtle.digest(
      { name: this.toWebCryptoAlgorithm(algorithm) },
      valueBuf,
    );
    return new Uint8Array(buffer);
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

  async aesGenerateKey(bitLength = 128 | 192 | 256 | 512): Promise<CsprngArray> {
    if (bitLength === 512) {
      // 512 bit keys are not supported in WebCrypto, so we concat two 256 bit keys
      const key1 = await this.aesGenerateKey(256);
      const key2 = await this.aesGenerateKey(256);
      return new Uint8Array([...key1, ...key2]) as CsprngArray;
    }
    const aesParams = {
      name: "AES-CBC",
      length: bitLength,
    };

    const key = await this.subtle.generateKey(aesParams, true, ["encrypt", "decrypt"]);
    const rawKey = await this.subtle.exportKey("raw", key);
    return new Uint8Array(rawKey) as CsprngArray;
  }

  randomBytes(length: number): Promise<CsprngArray> {
    const arr = new Uint8Array(length);
    this.crypto.getRandomValues(arr);
    return Promise.resolve(arr as CsprngArray);
  }

  private toBuf(value: string | Uint8Array): Uint8Array<ArrayBuffer> {
    let buf: Uint8Array<ArrayBuffer>;
    if (typeof value === "string") {
      buf = Utils.fromUtf8ToArray(value);
    } else {
      // Cannot really be shared array buffer, so it's ok to type assert
      buf = value as Uint8Array<ArrayBuffer>;
    }
    return buf;
  }

  private toByteString(value: string | Uint8Array): string {
    let bytes: string;
    if (typeof value === "string") {
      bytes = forge.util.encodeUtf8(value);
    } else {
      // Null assertion is safe because this function takes a non-null value and is private.
      bytes = Utils.fromArrayToByteString(this.toBuf(value));
    }
    return bytes;
  }

  private toWebCryptoAlgorithm(algorithm: "sha1" | "sha256" | "sha512" | "md5"): string {
    if (algorithm === "md5") {
      throw new Error("MD5 is not supported in WebCrypto.");
    }
    return algorithm === "sha1" ? "SHA-1" : algorithm === "sha256" ? "SHA-256" : "SHA-512";
  }

  private async hmac(
    value: Uint8Array,
    key: Uint8Array,
    algorithm: "sha256" | "sha512",
  ): Promise<Uint8Array<ArrayBuffer>> {
    const signingAlgorithm = {
      name: "HMAC",
      hash: { name: this.toWebCryptoAlgorithm(algorithm) },
    };

    const impKey = await this.subtle.importKey("raw", this.toBuf(key), signingAlgorithm, false, [
      "sign",
    ]);
    const buffer = await this.subtle.sign(signingAlgorithm, impKey, this.toBuf(value));
    return new Uint8Array(buffer);
  }
}
