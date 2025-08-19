import * as forge from "node-forge";

import { EncryptionType } from "../../../platform/enums";
import { Utils } from "../../../platform/misc/utils";
import {
  CbcDecryptParameters,
  EcbDecryptParameters,
} from "../../../platform/models/domain/decrypt-parameters";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "../../../types/csprng";
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

    const impKey = await this.subtle.importKey("raw", ikm, { name: "HKDF" } as any, false, [
      "deriveBits",
    ]);
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

  async hmac(
    value: Uint8Array,
    key: Uint8Array,
    algorithm: "sha1" | "sha256" | "sha512",
  ): Promise<Uint8Array> {
    const signingAlgorithm = {
      name: "HMAC",
      hash: { name: this.toWebCryptoAlgorithm(algorithm) },
    };

    const impKey = await this.subtle.importKey("raw", key, signingAlgorithm, false, ["sign"]);
    const buffer = await this.subtle.sign(signingAlgorithm, impKey, value);
    return new Uint8Array(buffer);
  }

  hmacFast(value: string, key: string, algorithm: "sha1" | "sha256" | "sha512"): Promise<string> {
    const hmac = forge.hmac.create();
    hmac.start(algorithm, key);
    hmac.update(value);
    const bytes = hmac.digest().getBytes();
    return Promise.resolve(bytes);
  }

  // Safely compare two values in a way that protects against timing attacks (Double HMAC Verification).
  // ref: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2011/february/double-hmac-verification/
  // ref: https://paragonie.com/blog/2015/11/preventing-timing-attacks-on-string-comparison-with-double-hmac-strategy
  async compareFast(a: string, b: string): Promise<boolean> {
    const rand = await this.randomBytes(32);
    const bytes = new Uint32Array(rand);
    const buffer = forge.util.createBuffer();
    for (let i = 0; i < bytes.length; i++) {
      buffer.putInt32(bytes[i]);
    }
    const macKey = buffer.getBytes();

    const hmac = forge.hmac.create();
    hmac.start("sha256", macKey);
    hmac.update(a);
    const mac1 = hmac.digest().getBytes();

    hmac.start("sha256", null);
    hmac.update(b);
    const mac2 = hmac.digest().getBytes();

    const equals = mac1 === mac2;
    return equals;
  }

  aesDecryptFastParameters(
    data: string,
    iv: string,
    mac: string | null,
    key: SymmetricCryptoKey,
  ): CbcDecryptParameters<string> {
    const innerKey = key.inner();
    if (innerKey.type === EncryptionType.AesCbc256_B64) {
      return {
        iv: forge.util.decode64(iv),
        data: forge.util.decode64(data),
        encKey: forge.util.createBuffer(innerKey.encryptionKey).getBytes(),
      } as CbcDecryptParameters<string>;
    } else if (innerKey.type === EncryptionType.AesCbc256_HmacSha256_B64) {
      const macData = forge.util.decode64(iv) + forge.util.decode64(data);
      return {
        iv: forge.util.decode64(iv),
        data: forge.util.decode64(data),
        encKey: forge.util.createBuffer(innerKey.encryptionKey).getBytes(),
        macKey: forge.util.createBuffer(innerKey.authenticationKey).getBytes(),
        mac: forge.util.decode64(mac!),
        macData,
      } as CbcDecryptParameters<string>;
    } else {
      throw new Error("Unsupported encryption type.");
    }
  }

  aesDecryptFast({
    mode,
    parameters,
  }:
    | { mode: "cbc"; parameters: CbcDecryptParameters<string> }
    | { mode: "ecb"; parameters: EcbDecryptParameters<string> }): Promise<string> {
    const decipher = (forge as any).cipher.createDecipher(
      this.toWebCryptoAesMode(mode),
      parameters.encKey,
    );
    const options = {} as any;
    if (mode === "cbc") {
      options.iv = parameters.iv;
    }
    const dataBuffer = (forge as any).util.createBuffer(parameters.data);
    decipher.start(options);
    decipher.update(dataBuffer);
    decipher.finish();
    const val = decipher.output.toString();
    return Promise.resolve(val);
  }

  async aesDecrypt(
    data: Uint8Array,
    iv: Uint8Array | null,
    key: Uint8Array,
    mode: "cbc" | "ecb",
  ): Promise<Uint8Array> {
    if (mode === "ecb") {
      // Web crypto does not support AES-ECB mode, so we need to do this in forge.
      const parameters: EcbDecryptParameters<string> = {
        data: this.toByteString(data),
        encKey: this.toByteString(key),
      };
      const result = await this.aesDecryptFast({ mode: "ecb", parameters });
      return Utils.fromByteStringToArray(result);
    }
    const impKey = await this.subtle.importKey("raw", key, { name: "AES-CBC" } as any, false, [
      "decrypt",
    ]);

    // CBC
    if (iv == null) {
      throw new Error("IV is required for CBC mode.");
    }
    const buffer = await this.subtle.decrypt({ name: "AES-CBC", iv: iv }, impKey, data);
    return new Uint8Array(buffer);
  }

  async rsaEncrypt(
    data: Uint8Array,
    publicKey: Uint8Array,
    algorithm: "sha1" | "sha256",
  ): Promise<Uint8Array> {
    // Note: Edge browser requires that we specify name and hash for both key import and decrypt.
    // We cannot use the proper types here.
    const rsaParams = {
      name: "RSA-OAEP",
      hash: { name: this.toWebCryptoAlgorithm(algorithm) },
    };
    const impKey = await this.subtle.importKey("spki", publicKey, rsaParams, false, ["encrypt"]);
    const buffer = await this.subtle.encrypt(rsaParams, impKey, data);
    return new Uint8Array(buffer);
  }

  async rsaDecrypt(
    data: Uint8Array,
    privateKey: Uint8Array,
    algorithm: "sha1" | "sha256",
  ): Promise<Uint8Array> {
    // Note: Edge browser requires that we specify name and hash for both key import and decrypt.
    // We cannot use the proper types here.
    const rsaParams = {
      name: "RSA-OAEP",
      hash: { name: this.toWebCryptoAlgorithm(algorithm) },
    };
    const impKey = await this.subtle.importKey("pkcs8", privateKey, rsaParams, false, ["decrypt"]);
    const buffer = await this.subtle.decrypt(rsaParams, impKey, data);
    return new Uint8Array(buffer);
  }

  async rsaExtractPublicKey(privateKey: Uint8Array): Promise<Uint8Array> {
    const rsaParams = {
      name: "RSA-OAEP",
      // Have to specify some algorithm
      hash: { name: this.toWebCryptoAlgorithm("sha1") },
    };
    const impPrivateKey = await this.subtle.importKey("pkcs8", privateKey, rsaParams, true, [
      "decrypt",
    ]);
    const jwkPrivateKey = await this.subtle.exportKey("jwk", impPrivateKey);
    const jwkPublicKeyParams = {
      kty: "RSA",
      e: jwkPrivateKey.e,
      n: jwkPrivateKey.n,
      alg: "RSA-OAEP",
      ext: true,
    };
    const impPublicKey = await this.subtle.importKey("jwk", jwkPublicKeyParams, rsaParams, true, [
      "encrypt",
    ]);
    const buffer = await this.subtle.exportKey("spki", impPublicKey);
    return new Uint8Array(buffer);
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

  async rsaGenerateKeyPair(length: 1024 | 2048 | 4096): Promise<[Uint8Array, Uint8Array]> {
    const rsaParams = {
      name: "RSA-OAEP",
      modulusLength: length,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
      // Have to specify some algorithm
      hash: { name: this.toWebCryptoAlgorithm("sha1") },
    };
    const keyPair = await this.subtle.generateKey(rsaParams, true, ["encrypt", "decrypt"]);
    const publicKey = await this.subtle.exportKey("spki", keyPair.publicKey);
    const privateKey = await this.subtle.exportKey("pkcs8", keyPair.privateKey);
    return [new Uint8Array(publicKey), new Uint8Array(privateKey)];
  }

  randomBytes(length: number): Promise<CsprngArray> {
    const arr = new Uint8Array(length);
    this.crypto.getRandomValues(arr);
    return Promise.resolve(arr as CsprngArray);
  }

  private toBuf(value: string | Uint8Array): Uint8Array {
    let buf: Uint8Array;
    if (typeof value === "string") {
      buf = Utils.fromUtf8ToArray(value);
    } else {
      buf = value;
    }
    return buf;
  }

  private toByteString(value: string | Uint8Array): string {
    let bytes: string;
    if (typeof value === "string") {
      bytes = forge.util.encodeUtf8(value);
    } else {
      bytes = Utils.fromBufferToByteString(value);
    }
    return bytes;
  }

  private toWebCryptoAlgorithm(algorithm: "sha1" | "sha256" | "sha512" | "md5"): string {
    if (algorithm === "md5") {
      throw new Error("MD5 is not supported in WebCrypto.");
    }
    return algorithm === "sha1" ? "SHA-1" : algorithm === "sha256" ? "SHA-256" : "SHA-512";
  }

  private toWebCryptoAesMode(mode: "cbc" | "ecb"): string {
    return mode === "cbc" ? "AES-CBC" : "AES-ECB";
  }
}
