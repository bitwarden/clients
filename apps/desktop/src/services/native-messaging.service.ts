import { Injectable } from "@angular/core";

import { isForwardedIpcMessage, isIpcMessage } from "@bitwarden/common/platform/ipc";

import { Message } from "../models/native-messaging/message";

import { DuckDuckGoMessageHandlerService } from "./duckduckgo-message-handler.service";

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
