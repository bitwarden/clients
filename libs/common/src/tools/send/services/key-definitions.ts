import { SEND_DISK, SEND_MEMORY, UserKeyDefinition } from "../../../platform/state";
import { SendData } from "../models/data/send.data";
import { SendView } from "../models/view/send.view";

/** Encrypted send state stored on disk */
export const SEND_USER_ENCRYPTED = UserKeyDefinition.record<SendData>(
  SEND_DISK,
  "sendUserEncrypted",
  {
    deserializer: (obj: SendData) => obj,
    clearOn: ["logout"],
  },
);

/** Decrypted send state stored in memory */
export const SEND_USER_DECRYPTED = new UserKeyDefinition<SendView[]>(
  SEND_MEMORY,
  "sendUserDecrypted",
  {
    deserializer: (obj) => obj,
    clearOn: ["lock"],
  },
);
