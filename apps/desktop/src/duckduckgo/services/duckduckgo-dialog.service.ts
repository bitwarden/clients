import { Injectable, OnDestroy } from "@angular/core";
import { concatMap, filter, firstValueFrom, Subject, takeUntil } from "rxjs";

import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import { DialogService } from "@bitwarden/components";

import { VerifyNativeMessagingDialogComponent } from "../../app/components/verify-native-messaging-dialog.component";
import { DDG_IPC_CHANNELS } from "../../models/native-messaging/ddg-ipc-channels";
import { rendererTeardownEnabled } from "../../platform/renderer-teardown-flag";

/**
 * A service to handle displaying UI prompts for DuckDuckGo connections. The protocol is run entirely in `main`.
 */
@Injectable({
  providedIn: "root",
})
export class DuckDuckGoDialogService implements OnDestroy {
  private destroy$ = new Subject<void>();

  /**
   * Feature flag rollout; This toggles whether main or renderer handle the protocol.
   */
  private mainOwnsDuckDuckGo = false;

  constructor(
    private dialogService: DialogService,
    private messageListener: MessageListener,
  ) {}

  async init() {
    this.mainOwnsDuckDuckGo = await rendererTeardownEnabled();

    this.messageListener
      .messages$(new CommandDefinition(DDG_IPC_CHANNELS.VERIFY_REQUEST))
      .pipe(
        filter(() => this.mainOwnsDuckDuckGo),
        concatMap(async (message) => {
          const dialogRef = VerifyNativeMessagingDialogComponent.open(this.dialogService, {
            applicationName: message.applicationName as string,
          });

          const accepted = (await firstValueFrom(dialogRef.closed)) ?? false;
          await ipc.platform.duckduckgo.verifyRequestResponse(
            message.requestId as number,
            accepted,
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
