// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { BROWSER_SEND_MEMORY, UserKeyDefinition } from "@bitwarden/common/platform/state";

import { BrowserComponentState } from "../../../models/browserComponentState";
import { BrowserSendComponentState } from "../../../models/browserSendComponentState";

export const BROWSER_SEND_COMPONENT = new UserKeyDefinition<BrowserSendComponentState>(
  BROWSER_SEND_MEMORY,
  "browser_send_component",
  {
    deserializer: (obj: Jsonify<BrowserSendComponentState>) =>
      BrowserSendComponentState.fromJSON(obj),
    clearOn: ["logout", "lock"],
  },
);

export const BROWSER_SEND_TYPE_COMPONENT = new UserKeyDefinition<BrowserComponentState>(
  BROWSER_SEND_MEMORY,
  "browser_send_type_component",
  {
    deserializer: (obj: Jsonify<BrowserComponentState>) => BrowserComponentState.fromJSON(obj),
    clearOn: ["logout", "lock"],
  },
);
