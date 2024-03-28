import { Observable } from "rxjs";

import { SendData } from "../models/data/send.data";
import { SendView } from "../models/view/send.view";

export abstract class SendStateProvider {
  encryptedState$: Observable<Record<string, SendData>>;
  decryptedState$: Observable<SendView[]>;

  getEncryptedSends: () => Promise<{ [id: string]: SendData }>;

  setEncryptedSends: (value: { [id: string]: SendData }) => Promise<void>;

  getDecryptedSends: () => Promise<SendView[]>;

  setDecryptedSends: (value: SendView[]) => Promise<void>;
}
