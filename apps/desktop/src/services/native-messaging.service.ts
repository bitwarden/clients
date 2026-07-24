import { Injectable } from "@angular/core";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { isForwardedIpcMessage, isIpcMessage } from "@bitwarden/common/platform/ipc";

import { LegacyMessageWrapper } from "../models/native-messaging/legacy-message-wrapper";
import { Message } from "../models/native-messaging/message";

import { BiometricMessageHandlerService } from "./biometric-message-handler.service";
import { DuckDuckGoMessageHandlerService } from "./duckduckgo-message-handler.service";

@Injectable()
export class NativeMessagingService {
  // When enabled, the legacy biometric protocol is handled in the main process
  // (see BiometricMessageHandlerMain), so the renderer must not also handle it.
  private biometricHandledInMainProcess = false;

  constructor(
    private duckduckgoMessageHandler: DuckDuckGoMessageHandlerService,
    private biometricMessageHandler: BiometricMessageHandlerService,
    private configService: ConfigService,
  ) {}

  init() {
    this.configService
      .getFeatureFlag$(FeatureFlag.MainProcessBiometricMessageHandler)
      .subscribe((enabled) => (this.biometricHandledInMainProcess = enabled));
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
      if (this.biometricHandledInMainProcess) {
        return;
      }
      await this.biometricMessageHandler.handleMessage(msg as LegacyMessageWrapper);
      return;
    }
  }
}
