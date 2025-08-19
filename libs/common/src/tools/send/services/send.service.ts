// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable, concatMap, distinctUntilChanged, firstValueFrom, map } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { PBKDF2KdfConfig, KeyService } from "@bitwarden/key-management";

import { KeyGenerationService } from "../../../key-management/crypto";
import { EncryptService } from "../../../key-management/crypto/abstractions/encrypt.service";
import { EncString } from "../../../key-management/crypto/models/enc-string";
import { I18nService } from "../../../platform/abstractions/i18n.service";
import { Utils } from "../../../platform/misc/utils";
import { EncArrayBuffer } from "../../../platform/models/domain/enc-array-buffer";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { SendType } from "../enums/send-type";
import { SendData } from "../models/data/send.data";
import { Send } from "../models/domain/send";
import { SendFile } from "../models/domain/send-file";
import { SendText } from "../models/domain/send-text";
import { SendWithIdRequest } from "../models/request/send-with-id.request";
import { SendView } from "../models/view/send.view";
import { SEND_KDF_ITERATIONS } from "../send-kdf";

import { SendStateProvider } from "./send-state.provider.abstraction";
import { InternalSendService as InternalSendServiceAbstraction } from "./send.service.abstraction";

export class SendService implements InternalSendServiceAbstraction {
  readonly sendKeySalt = "bitwarden-send";
  readonly sendKeyPurpose = "send";

  sends$ = this.stateProvider.encryptedState$.pipe(
    map(([, record]) => Object.values(record || {}).map((data) => new Send(data))),
  );
  sendViews$ = this.stateProvider.encryptedState$.pipe(
    concatMap(([, record]) =>
      this.decryptSends(Object.values(record || {}).map((data) => new Send(data))),
    ),
  );

  constructor(
    private keyService: KeyService,
    private i18nService: I18nService,
    private keyGenerationService: KeyGenerationService,
    private stateProvider: SendStateProvider,
    private encryptService: EncryptService,
  ) {}

  async encrypt(
    model: SendView,
    file: File | ArrayBuffer,
    password: string,
    userKey?: SymmetricCryptoKey,
  ): Promise<[Send, EncArrayBuffer]> {
    let fileData: EncArrayBuffer = null;
    const send = new Send();
    send.id = model.id;
    send.type = model.type;
    send.disabled = model.disabled;
    send.hideEmail = model.hideEmail;
    send.maxAccessCount = model.maxAccessCount;
    send.deletionDate = model.deletionDate;
    send.expirationDate = model.expirationDate;
    if (model.key == null) {
      // Sends use a seed, stored in the URL fragment. This seed is used to derive the key that is used for encryption.
      const key = await this.keyGenerationService.createKeyWithPurpose(
        128,
        this.sendKeyPurpose,
        this.sendKeySalt,
      );
      // key.material is the seed that can be used to re-derive the key
      model.key = key.material;
      model.cryptoKey = key.derivedKey;
    }

    const hasEmails = (model.emails?.length ?? 0) > 0;
    if (hasEmails) {
      send.emails = model.emails.join(",");
      send.password = null;
    } else if (password != null) {
      // Note: Despite being called key, the passwordKey is not used for encryption.
      // It is used as a static proof that the client knows the password, and has the encryption key.
      const passwordKey = await this.keyGenerationService.deriveKeyFromPassword(
        password,
        model.key,
        new PBKDF2KdfConfig(SEND_KDF_ITERATIONS),
      );
      send.password = passwordKey.keyB64;
    }
    if (userKey == null) {
      userKey = await this.keyService.getUserKey();
    }
    // Key is not a SymmetricCryptoKey, but key material used to derive the cryptoKey
    send.key = await this.encryptService.encryptBytes(model.key, userKey);
    // FIXME: model.name can be null. encryptString should not be called with null values.
    send.name = await this.encryptService.encryptString(model.name, model.cryptoKey);
    // FIXME: model.notes can be null. encryptString should not be called with null values.
    send.notes = await this.encryptService.encryptString(model.notes, model.cryptoKey);
    if (send.type === SendType.Text) {
      send.text = new SendText();
      // FIXME: model.text.text can be null. encryptString should not be called with null values.
      send.text.text = await this.encryptService.encryptString(model.text.text, model.cryptoKey);
      send.text.hidden = model.text.hidden;
    } else if (send.type === SendType.File) {
      send.file = new SendFile();
      if (file != null) {
        if (file instanceof ArrayBuffer) {
          const [name, data] = await this.encryptFileData(
            model.file.fileName,
            file,
            model.cryptoKey,
          );
          send.file.fileName = name;
          fileData = data;
        } else {
          fileData = await this.parseFile(send, file, model.cryptoKey);
        }
      }
    }

    return [send, fileData];
  }

  get$(id: string): Observable<Send | undefined> {
    return this.sends$.pipe(
      distinctUntilChanged((oldSends, newSends) => {
        const oldSend = oldSends.find((oldSend) => oldSend.id === id);
        const newSend = newSends.find((newSend) => newSend.id === id);
        if (!oldSend || !newSend) {
          // If either oldSend or newSend is not found, consider them different
          return false;
        }

        // Compare each property of the old and new Send objects
        const allPropertiesSame = Object.keys(newSend).every((key) => {
          if (
            (oldSend[key as keyof Send] != null && newSend[key as keyof Send] === null) ||
            (oldSend[key as keyof Send] === null && newSend[key as keyof Send] != null)
          ) {
            // If a key from either old or new send is not found, and the key from the other send has a value, consider them different
            return false;
          }

          switch (key) {
            case "name":
            case "notes":
            case "key":
              if (oldSend[key] === null && newSend[key] === null) {
                return true;
              }

              return oldSend[key].encryptedString === newSend[key].encryptedString;
            case "text":
              if (oldSend[key].text == null && newSend[key].text == null) {
                return true;
              }
              if (
                (oldSend[key].text != null && newSend[key].text == null) ||
                (oldSend[key].text == null && newSend[key].text != null)
              ) {
                return false;
              }
              return oldSend[key].text.encryptedString === newSend[key].text.encryptedString;
            case "file":
              //Files are never updated so never will be changed.
              return true;
            case "revisionDate":
            case "expirationDate":
            case "deletionDate":
              if (oldSend[key] === null && newSend[key] === null) {
                return true;
              }
              return oldSend[key].getTime() === newSend[key].getTime();
            default:
              // For other properties, compare directly
              return oldSend[key as keyof Send] === newSend[key as keyof Send];
          }
        });

        return allPropertiesSame;
      }),
      map((sends) => sends.find((o) => o.id === id)),
    );
  }

  async getFromState(id: string): Promise<Send> {
    const [, sends] = await this.stateProvider.getEncryptedSends();
    // eslint-disable-next-line
    if (sends == null || !sends.hasOwnProperty(id)) {
      return null;
    }

    return new Send(sends[id]);
  }

  async getAll(): Promise<Send[]> {
    const [, sends] = await this.stateProvider.getEncryptedSends();
    const response: Send[] = [];
    for (const id in sends) {
      // eslint-disable-next-line
      if (sends.hasOwnProperty(id)) {
        response.push(new Send(sends[id]));
      }
    }
    return response;
  }

  async getAllDecryptedFromState(userId: UserId): Promise<SendView[]> {
    let decSends = await this.stateProvider.getDecryptedSends();
    if (decSends != null) {
      return decSends;
    }

    decSends = [];
    const hasKey = await this.keyService.hasUserKey(userId);
    if (!hasKey) {
      throw new Error("No user key found.");
    }

    const promises: Promise<any>[] = [];
    const sends = await this.getAll();
    sends.forEach((send) => {
      promises.push(send.decrypt().then((f) => decSends.push(f)));
    });

    await Promise.all(promises);
    decSends.sort(Utils.getSortFunction(this.i18nService, "name"));

    await this.stateProvider.setDecryptedSends(decSends);
    return decSends;
  }

  async upsert(send: SendData | SendData[]): Promise<any> {
    const [userId, currentSends] = await this.stateProvider.getEncryptedSends();
    let sends = currentSends;
    if (sends == null) {
      sends = {};
    }
    if (send instanceof SendData) {
      const s = send as SendData;
      sends[s.id] = s;
    } else {
      (send as SendData[]).forEach((s) => {
        sends[s.id] = s;
      });
    }

    await this.replace(sends, userId);
  }

  async delete(id: string | string[]): Promise<any> {
    const [userId, sends] = await this.stateProvider.getEncryptedSends();
    if (sends == null) {
      return;
    }

    if (typeof id === "string") {
      if (sends[id] == null) {
        return;
      }
      delete sends[id];
    } else {
      (id as string[]).forEach((i) => {
        delete sends[i];
      });
    }

    await this.replace(sends, userId);
  }

  async replace(sends: { [id: string]: SendData }, userId: UserId): Promise<any> {
    await this.stateProvider.setEncryptedSends(sends, userId);
  }

  async getRotatedData(
    originalUserKey: UserKey,
    newUserKey: UserKey,
    userId: UserId,
  ): Promise<SendWithIdRequest[]> {
    if (newUserKey == null) {
      throw new Error("New user key is required for rotation.");
    }
    if (originalUserKey == null) {
      throw new Error("Original user key is required for rotation.");
    }

    const req = await firstValueFrom(
      this.sends$.pipe(
        concatMap(async (sends) => this.toRotatedKeyRequestMap(sends, originalUserKey, newUserKey)),
      ),
    );
    // separate return for easier debugging
    return req;
  }

  private async toRotatedKeyRequestMap(
    sends: Send[],
    originalUserKey: UserKey,
    rotateUserKey: UserKey,
  ) {
    const requests = await Promise.all(
      sends.map(async (send) => {
        // Send key is not a key but a 16 byte seed used to derive the key
        const sendKey = await this.encryptService.decryptBytes(send.key, originalUserKey);
        send.key = await this.encryptService.encryptBytes(sendKey, rotateUserKey);
        return new SendWithIdRequest(send);
      }),
    );
    return requests;
  }

  private parseFile(send: Send, file: File, key: SymmetricCryptoKey): Promise<EncArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      reader.onload = async (evt) => {
        try {
          const [name, data] = await this.encryptFileData(
            file.name,
            evt.target.result as ArrayBuffer,
            key,
          );
          send.file.fileName = name;
          resolve(data);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => {
        reject("Error reading file.");
      };
    });
  }

  private async encryptFileData(
    fileName: string,
    data: ArrayBuffer,
    key: SymmetricCryptoKey,
  ): Promise<[EncString, EncArrayBuffer]> {
    if (key == null) {
      key = await this.keyService.getUserKey();
    }
    const encFileName = await this.encryptService.encryptString(fileName, key);
    const encFileData = await this.encryptService.encryptFileData(new Uint8Array(data), key);
    return [encFileName, encFileData];
  }

  private async decryptSends(sends: Send[]) {
    const decryptSendPromises = sends.map((s) => s.decrypt());
    const decryptedSends = await Promise.all(decryptSendPromises);

    decryptedSends.sort(Utils.getSortFunction(this.i18nService, "name"));
    return decryptedSends;
  }
}
