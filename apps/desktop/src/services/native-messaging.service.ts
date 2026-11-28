import { Injectable } from "@angular/core";

import { isForwardedIpcMessage, isIpcMessage } from "@bitwarden/common/platform/ipc";

import { Message } from "../models/native-messaging/message";

import { DuckDuckGoMessageHandlerService } from "./duckduckgo-message-handler.service";

/**
 * Routes versioned native messages to the DuckDuckGo handler. Biometrics run over SDK IPC and do
 * not pass through here.
 *
 * @deprecated DuckDuckGo dropped support for the integration here
 * https://github.com/duckduckgo/apple-browsers/pull/7877. We will drop support after a transition
 * period.
 */
@Injectable()
export class NativeMessagingService {
  constructor(private duckduckgoMessageHandler: DuckDuckGoMessageHandlerService) {}

  init() {
    ipc.platform.nativeMessaging.onMessage((message) => this.messageHandler(message));
  }

  private async messageHandler(msg: Message) {
    // Ignore SDK IPC messages here
    if (isIpcMessage(msg) || isForwardedIpcMessage(msg)) {
      return;
    }

    // Only the DuckDuckGo protocol is versioned. Biometrics run over SDK IPC.
    if (msg.version) {
      await this.duckduckgoMessageHandler.handleMessage(msg);
    }
  }
}
