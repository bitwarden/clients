import { Observable } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.

// eslint-disable-next-line no-restricted-imports
import { EncArrayBuffer, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";

import { UserId } from "../../../types/guid";
import { SendData } from "../models/data/send.data";
import { Send } from "../models/domain/send";
import { SendView } from "../models/view/send.view";

export abstract class SendService {
  abstract sends$: Observable<Send[]>;
  abstract sendViews$: Observable<SendView[]>;

  /**
   * @param file The plaintext file bytes for a file send create, or `null` for text sends and
   *   edits.
   * @param password The plaintext password, when the user set or changed one. `null`/`undefined`
   *   means no password. Protected Data — never log it.
   */
  abstract encrypt(
    model: SendView,
    file: File | ArrayBuffer | null,
    password?: string,
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
