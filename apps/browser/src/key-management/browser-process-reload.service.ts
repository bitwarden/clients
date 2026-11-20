import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { DefaultProcessReloadService } from "@bitwarden/common/key-management/process-reload";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { BrowserApi } from "../platform/browser/browser-api";
import BrowserPopupUtils from "../platform/browser/browser-popup-utils";
import { BrowserTaskSchedulerService } from "../platform/services/abstractions/browser-task-scheduler.service";

/**
 * Browser implementation of the process reload. The extension is wiped by restarting it,
 * which requires tearing down scheduled tasks and popups first.
 */
export class BrowserProcessReloadService extends DefaultProcessReloadService {
  constructor(
    pinService: PinServiceAbstraction,
    messagingService: MessagingService,
    vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    accountService: AccountService,
    logService: LogService,
    authService: AuthService,
    private taskSchedulerService: BrowserTaskSchedulerService,
  ) {
    super(
      pinService,
      messagingService,
      vaultTimeoutSettingsService,
      accountService,
      logService,
      authService,
    );
  }

  protected override async performProcessReload(): Promise<void> {
    // Sends the "reloadProcess" message, which popups close themselves upon receiving.
    await super.performProcessReload();

    await this.taskSchedulerService.clearAllScheduledTasks();

    // Wait for the popup to actually close, otherwise the reload leaves behind a
    // zombie popup with an invalidated extension context.
    await BrowserPopupUtils.waitForAllPopupsClose();

    BrowserApi.reloadExtension();
  }
}
