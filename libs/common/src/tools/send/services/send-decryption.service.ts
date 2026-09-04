import { firstValueFrom, switchMap } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { LegacyCompatKeyService, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { SendClient } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { ConfigService } from "../../../platform/abstractions/config/config.service";
import { SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import { Utils } from "../../../platform/misc/utils";
import { Send } from "../models/domain/send";
import { SendAccess } from "../models/domain/send-access";
import { SendAccessResponse } from "../models/response/send-access.response";
import { SendAccessView } from "../models/view/send-access.view";
import { SendView } from "../models/view/send.view";

/**
 * Service for doing specific decryption operations for Send and SendAccess objects. It is expected
 * that this service will be deprecated once Sends are fully transferred to using the SDK and no
 * longer primarily operate on Sends, but on SendViews
 */
export class SendDecryptionService {
  constructor(
    private sdkService: SdkService,
    private configService: ConfigService,
    private legacyCompatKeyService: LegacyCompatKeyService,
  ) {}

  async decryptSend(send: Send, userId: UserId): Promise<SendView> {
    const useSdkForSends = await this.configService.getFeatureFlag(FeatureFlag.Pm30110SdkSendsApi);
    if (useSdkForSends) {
      return await firstValueFrom(
        this.sdkService.userClient$(userId).pipe(
          switchMap(async (sdk) => {
            if (!sdk) {
              throw new Error("SDK not available");
            }
            using ref = sdk.take();
            const sendsClient = ref.value.sends();
            const sdkSendView = sendsClient.decrypt_send(send.toSdkSend());
            const sendView = SendView.fromSdkSendView(sdkSendView);
            const decKey = await this.legacyCompatKeyService.makeSendKey(sendView.key);
            sendView.cryptoKey = decKey;
            return sendView;
          }),
        ),
      );
    } else {
      return send.decrypt(userId);
    }
  }

  async decryptSends(sends: Send[], userId: UserId): Promise<SendView[]> {
    const useSdkForSends = await this.configService.getFeatureFlag(FeatureFlag.Pm30110SdkSendsApi);
    if (useSdkForSends) {
      return await firstValueFrom(
        this.sdkService.userClient$(userId).pipe(
          switchMap(async (sdk) => {
            if (!sdk) {
              throw new Error("SDK not available");
            }
            using ref = sdk.take();
            const sendsClient = ref.value.sends();
            const sendViews = sends.map((s) =>
              SendView.fromSdkSendView(sendsClient.decrypt_send(s.toSdkSend())),
            );
            for (const s of sendViews) {
              s.cryptoKey = await this.legacyCompatKeyService.makeSendKey(s.key);
            }
            return sendViews;
          }),
        ),
      );
    } else {
      return Promise.all(sends.map((s) => s.decrypt(userId)));
    }
  }

  async decryptSendAccess(
    sendResponse: SendAccessResponse,
    keyArray: Uint8Array,
  ): Promise<[SendAccessView, SymmetricCryptoKey]> {
    const useSdkForSends = await this.configService.getFeatureFlag(FeatureFlag.Pm30110SdkSendsApi);
    const decKey = await this.legacyCompatKeyService.makeSendKey(keyArray);
    if (useSdkForSends) {
      const sdkAccessResponse = SendAccessResponse.toSdkAccessResponse(sendResponse);
      const key = Utils.fromArrayToUrlB64(keyArray);
      const sdkSendAccessView = SendClient.decrypt_send_access(key, sdkAccessResponse);
      return [SendAccessView.fromSdk(sdkSendAccessView), decKey];
    } else {
      const sendAccess = new SendAccess(sendResponse);
      const sendAccessView = await sendAccess.decrypt(decKey);
      return [sendAccessView, decKey];
    }
  }
}
