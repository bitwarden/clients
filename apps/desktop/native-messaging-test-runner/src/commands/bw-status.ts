import "module-alias/register";

import { NativeMessagingVersion } from "@bitwarden/common/enums";

import { LogUtils } from "../log-utils";
import NativeMessageService from "../native-message.service";
import { TestRunnerSdkLoadService } from "../sdk-load.service";
import * as config from "../variables";

// FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  // Initialize SDK before using crypto functions
  const sdkLoadService = new TestRunnerSdkLoadService();
  await sdkLoadService.loadAndInit();

  const nativeMessageService = new NativeMessageService(NativeMessagingVersion.One);

  LogUtils.logInfo("Sending Handshake");
  const handshakeResponse = await nativeMessageService.sendHandshake(
    config.testRsaPublicKey,
    config.applicationName,
  );
  LogUtils.logSuccess("Received response to handshake request");

  if (!handshakeResponse.status) {
    LogUtils.logError(" Handshake failed. Error was: " + handshakeResponse.error);
    nativeMessageService.disconnect();
    return;
  }
  LogUtils.logSuccess("Handshake success response");
  const status = await nativeMessageService.checkStatus(handshakeResponse.sharedKey);

  LogUtils.logSuccess("Status output is: ", status);
  nativeMessageService.disconnect();
})();
