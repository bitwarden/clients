import { Jsonify } from "type-fest";

import { BROWSER_SEND_MEMORY, KeyDefinition } from "@bitwarden/common/platform/state";

import { BrowserComponentState } from "../../../models/browserComponentState";
import { BrowserSendComponentState } from "../../../models/browserSendComponentState";

export const BROWSER_SEND_COMPONENT = new KeyDefinition<BrowserSendComponentState>(
  BROWSER_SEND_MEMORY,
  "browser_send_component",
  {
    deserializer: (obj: Jsonify<BrowserSendComponentState>) =>
      BrowserSendComponentState.fromJSON(obj),
  },
);

export const BROWSER_SEND_TYPE_COMPONENT = new KeyDefinition<BrowserComponentState>(
  BROWSER_SEND_MEMORY,
  "browser_send_type_component",
  {
    deserializer: (obj: Jsonify<BrowserComponentState>) => BrowserComponentState.fromJSON(obj),
  },
);
