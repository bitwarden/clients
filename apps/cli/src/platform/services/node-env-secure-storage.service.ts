// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { throwError } from "rxjs";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";

export class NodeEnvSecureStorageService implements AbstractStorageService {
  constructor(
    private storageService: AbstractStorageService,
    private logService: LogService,
    private encryptService: EncryptService,
  ) {}

  get valuesRequireDeserialization(): boolean {
    return true;
  }

  get updates$() {
    return throwError(
      () => new Error("Secure storage implementations cannot have their updates subscribed to."),
    );
  }

  async get<T>(key: string): Promise<T> {
    const value = await this.storageService.get<string>(this.makeProtectedStorageKey(key));
    if (value == null) {
      return null;
    }
    const obj = await this.decrypt(value);
    return obj as any;
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) != null;
  }

  async save(key: string, obj: any): Promise<void> {
    if (obj == null) {
      return this.remove(key);
    }

    if (obj !== null && typeof obj !== "string") {
      throw new Error("Only string storage is allowed.");
    }
    const protectedObj = await this.encrypt(obj);
    await this.storageService.save(this.makeProtectedStorageKey(key), protectedObj);
  }

  async remove(key: string): Promise<void> {
    await this.storageService.remove(this.makeProtectedStorageKey(key));
    return;
  }

  private async encrypt(plainValue: string): Promise<string> {
    const sessionKey = this.getSessionKey();
    if (sessionKey == null) {
      throw new Error("No session key available.");
    }
    const encValue = await this.encryptService.encryptToBytes(
      Utils.fromB64ToArray(plainValue),
      sessionKey,
    );
    if (encValue == null) {
      throw new Error("Value didn't encrypt.");
    }

    return Utils.fromBufferToB64(encValue.buffer);
  }

  private async decrypt(encValue: string): Promise<string> {
    try {
      const sessionKey = this.getSessionKey();
      if (sessionKey == null) {
        return null;
      }

      const encBuf = EncArrayBuffer.fromB64(encValue);
      const decValue = await this.encryptService.decryptToBytes(encBuf, sessionKey);
      if (decValue == null) {
        this.logService.info("Failed to decrypt.");
        return null;
      }

      return Utils.fromBufferToB64(decValue);
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      this.logService.info("Decrypt error.");
      return null;
    }
  }

  private getSessionKey() {
    try {
      if (process.env.BW_SESSION != null) {
        const sessionBuffer = Utils.fromB64ToArray(process.env.BW_SESSION);
        if (sessionBuffer != null) {
          const sessionKey = new SymmetricCryptoKey(sessionBuffer);
          if (sessionBuffer != null) {
            return sessionKey;
          }
        }
      }
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      this.logService.info("Session key is invalid.");
    }

    return null;
  }

  private makeProtectedStorageKey(key: string) {
    return "__PROTECTED__" + key;
  }
}
