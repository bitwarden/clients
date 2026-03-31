import { Jsonify } from "type-fest";

import { RECEIVE_DISK, UserKeyDefinition } from "../../../platform/state";
import { ReceiveData } from "../models/data/receive.data";

/** Encrypted receive state stored on disk */
export const RECEIVE_ENCRYPTED_RECEIVES = UserKeyDefinition.record<ReceiveData>(
  RECEIVE_DISK,
  "receives",
  {
    deserializer: (obj: Jsonify<ReceiveData>) => ReceiveData.fromJSON(obj),
    clearOn: ["logout"],
  },
);
