import { Send as SdkSend } from "@bitwarden/sdk-internal";

import { SdkRecordMapper } from "../../../../platform/services/sdk/client-managed-state";
import { UserKeyDefinition } from "../../../../platform/state";
import { SEND_USER_ENCRYPTED } from "../../services/key-definitions";
import { SendData } from "../data/send.data";

import { Send } from "./send";

/**
 * Bridges the client's `SEND_USER_ENCRYPTED` state to the SDK's send repository so the SDK can
 * read/write sends from the same state legacy sync already populates.
 */
export class SendRecordMapper implements SdkRecordMapper<SendData, SdkSend> {
  userKeyDefinition(): UserKeyDefinition<Record<string, SendData>> {
    return SEND_USER_ENCRYPTED;
  }

  toSdk(value: SendData): SdkSend {
    return new Send(value).toSdkSend();
  }

  fromSdk(value: SdkSend): SendData {
    return Send.fromSdkSend(value).toSendData();
  }
}
