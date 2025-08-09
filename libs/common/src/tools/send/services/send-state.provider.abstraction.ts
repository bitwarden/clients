import { Observable } from "rxjs";
import type { Simplify } from "type-fest";

import { CombinedState } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { SendData } from "../models/data/send.data";
import { SendView } from "../models/view/send.view";

type EncryptedSendState = Simplify<CombinedState<Record<string, SendData>>>;

export abstract class SendStateProvider {
  abstract encryptedState$: Observable<EncryptedSendState>;
  abstract decryptedState$: Observable<SendView[]>;

  abstract getEncryptedSends(): Promise<EncryptedSendState>;

  abstract setEncryptedSends(value: { [id: string]: SendData }, userId: UserId): Promise<void>;

  abstract getDecryptedSends(): Promise<SendView[]>;

  abstract setDecryptedSends(value: SendView[]): Promise<void>;
}
