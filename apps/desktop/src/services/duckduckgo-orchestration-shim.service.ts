import { Injectable } from "@angular/core";
import { catchError, concatMap, firstValueFrom, Subject, takeUntil } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import { DialogService } from "@bitwarden/components";

import { VerifyNativeMessagingDialogComponent } from "../app/components/verify-native-messaging-dialog.component";
import { DecryptedCommandData } from "../models/native-messaging/decrypted-command-data";
import { DDG_IPC_CHANNELS } from "../models/native-messaging/duckduckgo-ipc-channels";

import { EncryptedMessageHandlerService } from "./encrypted-message-handler.service";

/**
 * Renderer shim for the main-process DuckDuckGo handler (FeatureFlag.MainProcessDuckDuckGo).
 *
 * When the DuckDuckGo protocol is handled in main ({@link DuckDuckGoMessageHandlerMain}), the two
 * renderer-only concerns are delegated back here: showing the native-messaging verification dialog,
 * and executing commands (which need vault services) via the existing
 * {@link EncryptedMessageHandlerService}. Replies go back to main over the preload
 * `ipc.platform.duckduckgo.*` channels.
 */
@Injectable()
export class DuckDuckGoOrchestrationShimService {
  private destroy$ = new Subject<void>();

  constructor(
    private messageListener: MessageListener,
    private dialogService: DialogService,
    private encryptedMessageHandlerService: EncryptedMessageHandlerService,
    private configService: ConfigService,
    private logService: LogService,
  ) {}

  async init() {
    const enabled = await this.configService.getFeatureFlag(FeatureFlag.MainProcessDuckDuckGo);
    if (!enabled) {
      return;
    }

    this.messageListener
      .messages$(new CommandDefinition(DDG_IPC_CHANNELS.VERIFY_REQUEST))
      .pipe(
        concatMap(async (message: Record<string, unknown>) => {
          const requestId = message.requestId as number;
          const applicationName = message.applicationName as string;
          const verified = await firstValueFrom(
            VerifyNativeMessagingDialogComponent.open(this.dialogService, { applicationName })
              .closed,
          );
          await ipc.platform.duckduckgo.verifyResponse(requestId, verified === true);
        }),
        catchError((error: unknown, source) => {
          this.logService.error("Error handling DuckDuckGo verify request", error);
          return source;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.messageListener
      .messages$(new CommandDefinition(DDG_IPC_CHANNELS.COMMAND_REQUEST))
      .pipe(
        concatMap(async (message: Record<string, unknown>) => {
          const requestId = message.requestId as number;
          const commandData = message.commandData as DecryptedCommandData;
          let response: unknown;
          try {
            response =
              await this.encryptedMessageHandlerService.responseDataForCommand(commandData);
          } catch (error) {
            this.logService.error("Error executing DuckDuckGo command", error);
            response = {};
          }
          await ipc.platform.duckduckgo.commandResponse(requestId, response);
        }),
        catchError((error: unknown, source) => {
          this.logService.error("Error handling DuckDuckGo command request", error);
          return source;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }
}
