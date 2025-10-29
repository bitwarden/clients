import * as crypto from "crypto";

import * as forge from "node-forge";

import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { UnsignedPublicKey } from "@bitwarden/common/key-management/types";
import { EncryptionType } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  CbcDecryptParameters,
  EcbDecryptParameters,
} from "@bitwarden/common/platform/models/domain/decrypt-parameters";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";

export class NodeCryptoFunctionService implements CryptoFunctionService {
  pbkdf2(
    password: string | Uint8Array,
    salt: string | Uint8Array,
    algorithm: "sha256" | "sha512",
    iterations: number,
  ): Promise<Uint8Array> {
    const len = algorithm === "sha256" ? 32 : 64;
    const nodePassword = this.toNodeValue(password);
    const nodeSalt = this.toNodeValue(salt);
    return new Promise<Uint8Array>((resolve, reject) => {
      crypto.pbkdf2(nodePassword, nodeSalt, iterations, len, algorithm, (error, key) => {
        if (error != null) {
          reject(error);
        } else {
          resolve(this.toUint8Buffer(key));
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
    const saltBuf = this.toUint8Buffer(salt);
    const prk = await this.hmac(ikm, saltBuf, algorithm);
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
    const infoBuf = this.toUint8Buffer(info);
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
    const nodeValue = this.toNodeValue(value);
    const hash = crypto.createHash(algorithm);
    hash.update(nodeValue);
    return Promise.resolve(this.toUint8Buffer(hash.digest()));
  }

  hmac(
    value: Uint8Array,
    key: Uint8Array,
    algorithm: "sha1" | "sha256" | "sha512",
  ): Promise<Uint8Array> {
    const nodeValue = this.toNodeBuffer(value);
    const nodeKey = this.toNodeBuffer(key);
    const hmac = crypto.createHmac(algorithm, nodeKey);
    hmac.update(nodeValue);
    return Promise.resolve(this.toUint8Buffer(hmac.digest()));
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
    const nodeData = this.toNodeBuffer(data);
    const nodeIv = this.toNodeBuffer(iv);
    const nodeKey = this.toNodeBuffer(key);
    const cipher = crypto.createCipheriv("aes-256-cbc", nodeKey, nodeIv);
    const encBuf = Buffer.concat([cipher.update(nodeData), cipher.final()]);
    return Promise.resolve(this.toUint8Buffer(encBuf));
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
    const iv = mode === "cbc" ? parameters.iv : null;
    const decBuf = await this.aesDecrypt(parameters.data, iv, parameters.encKey, mode);
    return Utils.fromBufferToUtf8(decBuf);
  }

  aesDecrypt(
    data: Uint8Array,
    iv: Uint8Array | null,
    key: Uint8Array,
    mode: "cbc" | "ecb",
  ): Promise<Uint8Array> {
    const nodeData = this.toNodeBuffer(data);
    const nodeIv = this.toNodeBufferOrNull(iv);
    const nodeKey = this.toNodeBuffer(key);
    const decipher = crypto.createDecipheriv(this.toNodeCryptoAesMode(mode), nodeKey, nodeIv);
    const decBuf = Buffer.concat([decipher.update(nodeData), decipher.final()]);
    return Promise.resolve(this.toUint8Buffer(decBuf));
  }

  rsaEncrypt(
    data: Uint8Array,
    publicKey: Uint8Array,
    algorithm: "sha1" | "sha256",
  ): Promise<Uint8Array> {
    if (algorithm === "sha256") {
      throw new Error("Node crypto does not support RSA-OAEP SHA-256");
    }

    const pem = this.toPemPublicKey(publicKey);
    const decipher = crypto.publicEncrypt(pem, this.toNodeBuffer(data));
    return Promise.resolve(this.toUint8Buffer(decipher));
  }

  rsaDecrypt(
    data: Uint8Array,
    privateKey: Uint8Array,
    algorithm: "sha1" | "sha256",
  ): Promise<Uint8Array> {
    if (algorithm === "sha256") {
      throw new Error("Node crypto does not support RSA-OAEP SHA-256");
    }

    const pem = this.toPemPrivateKey(privateKey);
    const decipher = crypto.privateDecrypt(pem, this.toNodeBuffer(data));
    return Promise.resolve(this.toUint8Buffer(decipher));
  }

  async rsaExtractPublicKey(privateKey: Uint8Array): Promise<UnsignedPublicKey> {
    const privateKeyByteString = Utils.fromBufferToByteString(privateKey);
    const privateKeyAsn1 = forge.asn1.fromDer(privateKeyByteString);
    const forgePrivateKey: any = forge.pki.privateKeyFromAsn1(privateKeyAsn1);
    const forgePublicKey = (forge.pki as any).setRsaPublicKey(forgePrivateKey.n, forgePrivateKey.e);
    const publicKeyAsn1 = forge.pki.publicKeyToAsn1(forgePublicKey);
    const publicKeyByteString = forge.asn1.toDer(publicKeyAsn1).data;
    const publicKeyArray = Utils.fromByteStringToArray(publicKeyByteString);
    return publicKeyArray as UnsignedPublicKey;
  }

  async rsaGenerateKeyPair(length: 1024 | 2048 | 4096): Promise<[UnsignedPublicKey, Uint8Array]> {
    return new Promise<[UnsignedPublicKey, Uint8Array]>((resolve, reject) => {
      forge.pki.rsa.generateKeyPair(
        {
          bits: length,
          workers: -1,
          e: 0x10001, // 65537
        },
        (error, keyPair) => {
          if (error != null) {
            reject(error);
            return;
          }

          const publicKeyAsn1 = forge.pki.publicKeyToAsn1(keyPair.publicKey);
          const publicKeyByteString = forge.asn1.toDer(publicKeyAsn1).getBytes();
          const publicKey = Utils.fromByteStringToArray(publicKeyByteString);

          const privateKeyAsn1 = forge.pki.privateKeyToAsn1(keyPair.privateKey);
          const privateKeyPkcs8 = forge.pki.wrapRsaPrivateKey(privateKeyAsn1);
          const privateKeyByteString = forge.asn1.toDer(privateKeyPkcs8).getBytes();
          const privateKey = Utils.fromByteStringToArray(privateKeyByteString);

          resolve([publicKey as UnsignedPublicKey, privateKey]);
        },
      );
    });
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
          resolve(this.toUint8Buffer(bytes) as CsprngArray);
        }
      });
    });
  }

  private toNodeValue(value: string | Uint8Array): string | Buffer {
    let nodeValue: string | Buffer;
    if (typeof value === "string") {
      nodeValue = value;
    } else {
      nodeValue = this.toNodeBuffer(value);
    }
    return nodeValue;
  }

  private toNodeBuffer(value: Uint8Array): Buffer {
    return Buffer.from(value);
  }

  private toNodeBufferOrNull(value: Uint8Array | null): Buffer | null {
    if (value == null) {
      return null;
    }
    return this.toNodeBuffer(value);
  }

  private toUint8Buffer(value: Buffer | string | Uint8Array): Uint8Array {
    let buf: Uint8Array;
    if (typeof value === "string") {
      buf = Utils.fromUtf8ToArray(value);
    } else {
      buf = value;
    }
    return buf;
  }

  private toPemPrivateKey(key: Uint8Array): string {
    const byteString = Utils.fromBufferToByteString(key);
    const asn1 = forge.asn1.fromDer(byteString);
    const privateKey = forge.pki.privateKeyFromAsn1(asn1);
    const rsaPrivateKey = forge.pki.privateKeyToAsn1(privateKey);
    const privateKeyInfo = forge.pki.wrapRsaPrivateKey(rsaPrivateKey);
    return forge.pki.privateKeyInfoToPem(privateKeyInfo);
  }

  private toPemPublicKey(key: Uint8Array): string {
    const byteString = Utils.fromBufferToByteString(key);
    const asn1 = forge.asn1.fromDer(byteString);
    const publicKey = forge.pki.publicKeyFromAsn1(asn1);
    return forge.pki.publicKeyToPem(publicKey);
  }

  private toNodeCryptoAesMode(mode: "cbc" | "ecb"): string {
    return mode === "cbc" ? "aes-256-cbc" : "aes-256-ecb";
  }
}
