// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";
import type { Simplify } from "type-fest";

import { CombinedState } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { SendData } from "../models/data/send.data";
import { SendView } from "../models/view/send.view";

type EncryptedSendState = Simplify<CombinedState<Record<string, SendData>>>;
export abstract class SendStateProvider {
  encryptedState$: Observable<EncryptedSendState>;
  decryptedState$: Observable<SendView[]>;

  getEncryptedSends: () => Promise<EncryptedSendState>;

  setEncryptedSends: (value: { [id: string]: SendData }, userId: UserId) => Promise<void>;

  getDecryptedSends: () => Promise<SendView[]>;

  setDecryptedSends: (value: SendView[]) => Promise<void>;
}
