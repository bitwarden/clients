import { Observable } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { UserKeyRotationDataProvider } from "@bitwarden/key-management";

import { EncArrayBuffer } from "../../../platform/models/domain/enc-array-buffer";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { SendData } from "../models/data/send.data";
import { Send } from "../models/domain/send";
import { SendWithIdRequest } from "../models/request/send-with-id.request";
import { SendView } from "../models/view/send.view";

export abstract class SendService implements UserKeyRotationDataProvider<SendWithIdRequest> {
  abstract sends$: Observable<Send[]>;
  abstract sendViews$: Observable<SendView[]>;

  abstract encrypt(
    model: SendView,
    file: File | ArrayBuffer,
    password: string,
    key?: SymmetricCryptoKey,
  ): Promise<[Send, EncArrayBuffer]>;
  /**
   * Provides a send for a determined id
   * updates after a change occurs to the send that matches the id
   * @param id The id of the desired send
   * @returns An observable that listens to the value of the desired send
   */
  abstract get$(id: string): Observable<Send | undefined>;
  /**
   * Provides re-encrypted user sends for the key rotation process
   * @param newUserKey The new user key to use for re-encryption
   * @throws Error if the new user key is null or undefined
   * @returns A list of user sends that have been re-encrypted with the new user key
   */
  abstract getRotatedData(
    originalUserKey: UserKey,
    newUserKey: UserKey,
    userId: UserId,
  ): Promise<SendWithIdRequest[]>;
  /**
   * @deprecated Do not call this, use the sends$ observable collection
   */
  abstract getAll(): Promise<Send[]>;
  /**
   * @deprecated Only use in CLI
   */
  abstract getFromState(id: string): Promise<Send>;
  /**
   * @deprecated Only use in CLI
   */
  abstract getAllDecryptedFromState(userId: UserId): Promise<SendView[]>;
}

export abstract class InternalSendService extends SendService {
  abstract upsert(send: SendData | SendData[]): Promise<any>;
  abstract replace(sends: { [id: string]: SendData }, userId: UserId): Promise<void>;
  abstract delete(id: string | string[]): Promise<any>;
}
