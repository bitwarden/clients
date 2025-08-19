import { KeyDefinition, SEND_ACCESS_AUTH_MEMORY } from "@bitwarden/common/platform/state";
import { SendAccessResponse } from "@bitwarden/common/tools/send/models/response/send-access.response";

import { SendContext } from "./types";

export const SEND_CONTEXT_KEY = new KeyDefinition<SendContext | null>(
  SEND_ACCESS_AUTH_MEMORY,
  "sendContext",
  {
    deserializer: (data) => data,
  },
);

/** When send authentication succeeds, this stores the result so that
 *  multiple access attempts don't accrue due to the send workflow.
 */
// FIXME: replace this with the send authentication token once it's
//   available
export const SEND_RESPONSE_KEY = new KeyDefinition<SendAccessResponse | null>(
  SEND_ACCESS_AUTH_MEMORY,
  "sendResponse",
  {
    deserializer: (data) => (data ? new SendAccessResponse(data) : null),
  },
);
