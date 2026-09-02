import { firstValueFrom, switchMap } from "rxjs";

import {
  SendView as SdkSendView,
  SendClient,
  SendAccessView as SdkSendAccessView,
  SymmetricKey,
} from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

import { SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import { Send } from "../models/domain/send";
import { SendAccessResponse } from "../models/response/send-access.response";

/**
 * Service for doing specific decryption operations for Send and SendAccess objects. It is expected
 * that this service will be deprecated once Sends are fully transferred to using the SDK and no
 * longer primarily operate on Sends, but on SendViews
 */
export class SendSdkDecryptionService {
  constructor(private sdkService: SdkService) {}

  async decryptSend(send: Send, userId: UserId): Promise<SdkSendView> {
    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          const sendsClient = ref.value.sends();
          return sendsClient.decrypt_send(send.toSdkSend());
        }),
      ),
    );
  }

  async decryptSendAccess(
    sendAccess: SendAccessResponse,
    key: SymmetricKey,
  ): Promise<SdkSendAccessView> {
    const sdkAccessResponse = SendAccessResponse.toSdkAccessResponse(sendAccess);
    return SendClient.decrypt_send_access(key, sdkAccessResponse);
  }
}
