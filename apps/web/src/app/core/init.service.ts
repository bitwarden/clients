import { Inject, Injectable, DOCUMENT } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { OrganizationInviteService } from "@bitwarden/common/auth/organization-invite";
import { TwoFactorService } from "@bitwarden/common/auth/two-factor";
import { EventUploadService as EventUploadServiceAbstraction } from "@bitwarden/common/dirt/event-logs";
import { EventUploadService } from "@bitwarden/common/dirt/event-logs/services/event-upload.service";
import { SharedUnlockPeerService } from "@bitwarden/common/key-management/shared-unlock";
import { DefaultVaultTimeoutService } from "@bitwarden/common/key-management/vault-timeout";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { ContainerService } from "@bitwarden/common/platform/services/container.service";
import { MigrationRunner } from "@bitwarden/common/platform/services/migration-runner";
import { UserId } from "@bitwarden/common/types/guid";
import { TaskService } from "@bitwarden/common/vault/tasks";
import { KeyService as KeyServiceAbstraction } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService, LegacyCompatKeyService } from "@bitwarden/legacy-crypto";
import { LogService } from "@bitwarden/logging";
import { UnlockService } from "@bitwarden/unlock";

import { VersionService } from "../platform/version.service";

@Injectable()
export class InitService {
  constructor(
    @Inject(WINDOW) private win: Window,
    private serverNotificationsService: ServerNotificationsService,
    private vaultTimeoutService: DefaultVaultTimeoutService,
    private i18nService: I18nServiceAbstraction,
    private eventUploadService: EventUploadServiceAbstraction,
    private twoFactorService: TwoFactorService,
    private keyService: KeyServiceAbstraction,
    private themingService: AbstractThemingService,
    private encryptService: EncryptService,
    private unlockService: UnlockService,
    private accountService: AccountService,
    private tokenService: TokenService,
    private versionService: VersionService,
    private ipcService: IpcService,
    private sdkLoadService: SdkLoadService,
    private taskService: TaskService,
    private readonly migrationRunner: MigrationRunner,
    @Inject(DOCUMENT) private document: Document,
    private sharedUnlockPeerService: SharedUnlockPeerService,
    private legacyCompatKeyService: LegacyCompatKeyService,
    private organizationInviteService: OrganizationInviteService,
    private logService: LogService,
  ) {}

  init() {
    return async () => {
      await this.sdkLoadService.loadAndInit();
      await this.migrationRunner.run();

      const accounts = await firstValueFrom(this.accountService.accounts$);
      await this.tokenService.cleanupTokenStorage(Object.keys(accounts) as UserId[]);

      const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
      if (activeAccount) {
        // If there is an active account, we must await the process of setting the user key in memory
        // if the auto user key is set to avoid race conditions of any code trying to access the user key from mem.
        // A failure here leaves the account locked rather than failing app initialization.
        try {
          await this.unlockService.unlockWithAutoUnlockKey(activeAccount.id);
        } catch (e) {
          this.logService.error("[InitService] Failed to auto-unlock user on startup", e);
        }
      }

      this.serverNotificationsService.startListening();
      await this.vaultTimeoutService.init(true);
      await this.i18nService.init();
      (this.eventUploadService as EventUploadService).init(true);
      this.twoFactorService.init();
      const htmlEl = this.win.document.documentElement;
      htmlEl.classList.add("locale_" + this.i18nService.translationLocale);
      this.themingService.applyThemeChangesTo(this.document);
      this.versionService.applyVersionToWindow();
      await this.ipcService.init();
      await this.sharedUnlockPeerService.start();
      this.taskService.listenForTaskNotifications();

      // Opportunistic sweep of any sealed open-org-invite secrets whose TTL has expired
      // (defense-in-depth for abandoned registration-crossing flows). Runs unconditionally
      // once per boot so seeded entries still get cleaned up
      // The sweep is a cheap no-op when the state is empty. Wrapped so a
      // sweep failure does not block app startup.
      try {
        await this.organizationInviteService.clearExpiredSealedOpenOrgInviteSecrets();
      } catch {
        // Non-fatal: entries linger until the next boot's sweep.
      }

      const containerService = new ContainerService(
        this.keyService,
        this.encryptService,
        this.legacyCompatKeyService,
      );
      containerService.attachToGlobal(this.win);
    };
  }
}
