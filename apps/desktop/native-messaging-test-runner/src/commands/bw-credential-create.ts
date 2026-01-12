// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import "module-alias/register";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { NativeMessagingVersion } from "@bitwarden/common/enums";

// eslint-disable-next-line no-restricted-imports
import { CredentialCreatePayload } from "../../../src/models/native-messaging/encrypted-message-payloads/credential-create-payload";
import { LogUtils } from "../log-utils";
import NativeMessageService from "../native-message.service";
import * as config from "../variables";

const argv: any = yargs(hideBin(process.argv)).option("name", {
  alias: "n",
  demand: true,
  describe: "Name that the created login will be given",
  type: "string",
}).argv;

const { name } = argv;

// FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  const nativeMessageService = new NativeMessageService(NativeMessagingVersion.One);
  // Handshake
  LogUtils.logInfo("Sending Handshake");
  const handshakeResponse = await nativeMessageService.sendHandshake(
    config.testRsaPublicKey,
    config.applicationName,
  );

  if (!handshakeResponse.status) {
    LogUtils.logError(" Handshake failed. Error was: " + handshakeResponse.error);
    nativeMessageService.disconnect();
    return;
  }

  // Get active account userId
  const status = await nativeMessageService.checkStatus(handshakeResponse.sharedKey);

  const activeUser = status.payload.filter((a) => a.active === true && a.status === "unlocked")[0];
  if (activeUser === undefined) {
    LogUtils.logError("No active or unlocked user");
  }
  LogUtils.logInfo("Active userId: " + activeUser.id);

  LogUtils.logSuccess("Handshake success response");
  const response = await nativeMessageService.credentialCreation(handshakeResponse.sharedKey, {
    name: name,
    userName: "SuperAwesomeUser",
    password: "dolphin",
    uri: "google.com",
    userId: activeUser.id,
  } as CredentialCreatePayload);

  if (response.payload.status === "failure") {
    LogUtils.logError("Failure response returned ");
  } else if (response.payload.status === "success") {
    LogUtils.logSuccess("Success response returned ");
  } else if (response.payload.error === "locked") {
    LogUtils.logError("Error: vault is locked");
  } else {
    LogUtils.logWarning("Other response: ", response);
  }

  nativeMessageService.disconnect();
})();
