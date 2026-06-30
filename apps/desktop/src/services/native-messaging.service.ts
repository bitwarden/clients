import { Injectable } from "@angular/core";

import { isForwardedIpcMessage, isIpcMessage } from "@bitwarden/common/platform/ipc";

import { LegacyMessageWrapper } from "../models/native-messaging/legacy-message-wrapper";
import { Message } from "../models/native-messaging/message";

import { BiometricMessageHandlerService } from "./biometric-message-handler.service";
import { DuckDuckGoMessageHandlerService } from "./duckduckgo-message-handler.service";

@Injectable()
export class NativeMessagingService {
  constructor(
    private duckduckgoMessageHandler: DuckDuckGoMessageHandlerService,
    private biometricMessageHandler: BiometricMessageHandlerService,
  ) {}

  init() {
    ipc.platform.nativeMessaging.onMessage((message) => this.messageHandler(message));
  }

  private async messageHandler(msg: LegacyMessageWrapper | Message) {
    const outerMessage = msg as Message;

    // Ignore SDK IPC messages here
    if (isIpcMessage(msg) || isForwardedIpcMessage(msg)) {
      return;
    }

    if (outerMessage.version) {
      // If there is a version, it is a using the protocol created for the DuckDuckGo integration
      await this.duckduckgoMessageHandler.handleMessage(outerMessage);
      return;
    } else {
      await this.biometricMessageHandler.handleMessage(msg as LegacyMessageWrapper);
      return;
    }
  }
}
