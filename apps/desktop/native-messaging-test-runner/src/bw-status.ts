import "module-alias/register";

import { NativeMessagingVersion } from "@bitwarden/common/enums/nativeMessagingVersion";

import { LogUtils } from "./logUtils";
import NativeMessageService from "./nativeMessageService";
import * as config from "./variables";

(async () => {
  const nativeMessageService = new NativeMessageService(NativeMessagingVersion.One);

  LogUtils.logInfo("Sending Handshake");
  const handshakeResponse = await nativeMessageService.sendHandshake(config.testRsaPublicKey);
  LogUtils.logSuccess("Received response to handshake request");

  if (handshakeResponse.status !== "success") {
    LogUtils.logError(" Handshake failed. Status was:", handshakeResponse.status);
    nativeMessageService.disconnect();
    return;
  }
  LogUtils.logSuccess("Handshake success response");
  const status = await nativeMessageService.checkStatus(handshakeResponse.sharedKey);

  LogUtils.logSuccess("Status output is: ", status);
  nativeMessageService.disconnect();
})();
