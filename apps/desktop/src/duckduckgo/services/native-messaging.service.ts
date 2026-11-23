import { Injectable } from "@angular/core";

import { isForwardedIpcMessage, isIpcMessage } from "@bitwarden/common/platform/ipc";

import { Message } from "../../models/native-messaging/message";
import { rendererTeardownEnabled } from "../../platform/renderer-teardown-flag";

import { DuckDuckGoMessageHandlerService } from "./duckduckgo-message-handler.service";

@Injectable()
export class NativeMessagingService {
  /** Feature flag rollout; This toggles whether main or renderer handle the protocol. */
  private mainAnswersDuckDuckGo = false;

  constructor(private duckduckgoMessageHandler: DuckDuckGoMessageHandlerService) {}

  async init() {
    this.mainAnswersDuckDuckGo = await rendererTeardownEnabled();
    ipc.platform.nativeMessaging.onMessage((message) => this.messageHandler(message));
  }

  private async messageHandler(msg: Message) {
    if (this.mainAnswersDuckDuckGo) {
      return;
    }

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
