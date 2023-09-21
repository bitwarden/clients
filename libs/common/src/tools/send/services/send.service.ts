import { BehaviorSubject, concatMap } from "rxjs";

import { SEND_KDF_ITERATIONS } from "../../../enums";
import { CryptoFunctionService } from "../../../platform/abstractions/crypto-function.service";
import { CryptoService } from "../../../platform/abstractions/crypto.service";
import { I18nService } from "../../../platform/abstractions/i18n.service";
import { StateService } from "../../../platform/abstractions/state.service";
import { Utils } from "../../../platform/misc/utils";
import { EncArrayBuffer } from "../../../platform/models/domain/enc-array-buffer";
import { EncString } from "../../../platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { SendType } from "../enums/send-type";
import { SendData } from "../models/data/send.data";
import { Send } from "../models/domain/send";
import { SendFile } from "../models/domain/send-file";
import { SendText } from "../models/domain/send-text";
import { SendView } from "../models/view/send.view";

import { InternalSendService as InternalSendServiceAbstraction } from "./send.service.abstraction";

export class SendService implements InternalSendServiceAbstraction {
  protected _sends: BehaviorSubject<Send[]> = new BehaviorSubject([]);
  protected _sendViews: BehaviorSubject<SendView[]> = new BehaviorSubject([]);

  sends$ = this._sends.asObservable();
  sendViews$ = this._sendViews.asObservable();

  constructor(
    private cryptoService: CryptoService,
    private i18nService: I18nService,
    private cryptoFunctionService: CryptoFunctionService,
    private stateService: StateService
  ) {
    this.stateService.activeAccountUnlocked$
      .pipe(
        concatMap(async (unlocked) => {
          if (Utils.global.bitwardenContainerService == null) {
            return;
          }

          if (!unlocked) {
            this._sends.next([]);
            this._sendViews.next([]);
            return;
          }

          const data = await this.stateService.getEncryptedSends();

          await this.updateObservables(data);
        })
      )
      .subscribe();
  }

  async clearCache(): Promise<void> {
    await this._sendViews.next([]);
  }

  async encrypt(
    model: SendView,
    file: File | ArrayBuffer,
    password: string,
    key?: SymmetricCryptoKey
  ): Promise<[Send, EncArrayBuffer]> {
    let fileData: EncArrayBuffer = null;
    const send = new Send();
    send.id = model.id;
    send.type = model.type;
    send.disabled = model.disabled;
    send.hideEmail = model.hideEmail;
    send.maxAccessCount = model.maxAccessCount;
    if (model.key == null) {
      model.key = await this.cryptoFunctionService.aesGenerateKey(128);
      model.cryptoKey = await this.cryptoService.makeSendKey(model.key);
    }
    if (password != null) {
      const passwordHash = await this.cryptoFunctionService.pbkdf2(
        password,
        model.key,
        "sha256",
        SEND_KDF_ITERATIONS
      );
      send.password = Utils.fromBufferToB64(passwordHash);
    }
    send.key = await this.cryptoService.encrypt(model.key, key);
    send.name = await this.cryptoService.encrypt(model.name, model.cryptoKey);
    send.notes = await this.cryptoService.encrypt(model.notes, model.cryptoKey);
    if (send.type === SendType.Text) {
      send.text = new SendText();
      send.text.text = await this.cryptoService.encrypt(model.text.text, model.cryptoKey);
      send.text.hidden = model.text.hidden;
    } else if (send.type === SendType.File) {
      send.file = new SendFile();
      if (file != null) {
        if (file instanceof ArrayBuffer) {
          const [name, data] = await this.encryptFileData(
            model.file.fileName,
            file,
            model.cryptoKey
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

  get(id: string): Send {
    const sends = this._sends.getValue();
    return sends.find((send) => send.id === id);
  }

  async getFromState(id: string): Promise<Send> {
    const sends = await this.stateService.getEncryptedSends();
    // eslint-disable-next-line
    if (sends == null || !sends.hasOwnProperty(id)) {
      return null;
    }

    return new Send(sends[id]);
  }

  async getAll(): Promise<Send[]> {
    const sends = await this.stateService.getEncryptedSends();
    const response: Send[] = [];
    for (const id in sends) {
      // eslint-disable-next-line
      if (sends.hasOwnProperty(id)) {
        response.push(new Send(sends[id]));
      }
    }
    return response;
  }

  async getAllDecryptedFromState(): Promise<SendView[]> {
    let decSends = await this.stateService.getDecryptedSends();
    if (decSends != null) {
      return decSends;
    }

    decSends = [];
    const hasKey = await this.cryptoService.hasUserKey();
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

    await this.stateService.setDecryptedSends(decSends);
    return decSends;
  }

  async upsert(send: SendData | SendData[]): Promise<any> {
    let sends = await this.stateService.getEncryptedSends();
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

    await this.replace(sends);
  }

  async clear(userId?: string): Promise<any> {
    if (userId == null || userId == (await this.stateService.getUserId())) {
      this._sends.next([]);
      this._sendViews.next([]);
    }
    await this.stateService.setDecryptedSends(null, { userId: userId });
    await this.stateService.setEncryptedSends(null, { userId: userId });
  }

  async delete(id: string | string[]): Promise<any> {
    const sends = await this.stateService.getEncryptedSends();
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

    await this.replace(sends);
  }

  async replace(sends: { [id: string]: SendData }): Promise<any> {
    await this.updateObservables(sends);
    await this.stateService.setEncryptedSends(sends);
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
            key
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
    key: SymmetricCryptoKey
  ): Promise<[EncString, EncArrayBuffer]> {
    const encFileName = await this.cryptoService.encrypt(fileName, key);
    const encFileData = await this.cryptoService.encryptToBytes(new Uint8Array(data), key);
    return [encFileName, encFileData];
  }

  private async updateObservables(sendsMap: { [id: string]: SendData }) {
    const sends = Object.values(sendsMap || {}).map((f) => new Send(f));
    this._sends.next(sends);

    if (await this.cryptoService.hasUserKey()) {
      this._sendViews.next(await this.decryptSends(sends));
    }
  }

  private async decryptSends(sends: Send[]) {
    const decryptSendPromises = sends.map((s) => s.decrypt());
    const decryptedSends = await Promise.all(decryptSendPromises);

    decryptedSends.sort(Utils.getSortFunction(this.i18nService, "name"));
    return decryptedSends;
  }
}
