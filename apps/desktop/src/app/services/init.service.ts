import { Inject, Injectable, DOCUMENT } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { AutomationDriver } from "@bitwarden/automation-driver";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { TwoFactorService } from "@bitwarden/common/auth/two-factor";
import { EventUploadService as EventUploadServiceAbstraction } from "@bitwarden/common/dirt/event-logs";
import { EventUploadService } from "@bitwarden/common/dirt/event-logs/services/event-upload.service";
import { SharedUnlockPeerService } from "@bitwarden/common/key-management/shared-unlock";
import { DefaultVaultTimeoutService } from "@bitwarden/common/key-management/vault-timeout";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService as PlatformUtilsServiceAbstraction } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { ContainerService } from "@bitwarden/common/platform/services/container.service";
import { MigrationRunner } from "@bitwarden/common/platform/services/migration-runner";
import { SyncService as SyncServiceAbstraction } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsService, KeyService as KeyServiceAbstraction } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService, LegacyCompatKeyService } from "@bitwarden/legacy-crypto";
import { LogService } from "@bitwarden/logging";
import { UnlockService } from "@bitwarden/unlock";

import { DesktopAutofillService } from "../../autofill/services/desktop-autofill.service";
import { DesktopAutotypeMvpService } from "../../autofill/services/desktop-autotype-mvp.service";
import { SshAgentService } from "../../autofill/services/ssh-agent.service";
import { I18nRendererService } from "../../platform/services/i18n.renderer.service";
import { ServerCommunicationConfigService } from "../../platform/services/server-communication-config/server-communication-config.service";
import { VersionService } from "../../platform/services/version.service";
import { BiometricMessageHandlerService } from "../../services/biometric-message-handler.service";
import { NativeMessagingService } from "../../services/native-messaging.service";

import { UpdateRestartService } from "./update-restart.service";

@Injectable()
export class InitService {
  constructor(
    @Inject(WINDOW) private win: Window,
    private syncService: SyncServiceAbstraction,
    private vaultTimeoutService: DefaultVaultTimeoutService,
    private i18nService: I18nServiceAbstraction,
    private eventUploadService: EventUploadServiceAbstraction,
    private twoFactorService: TwoFactorService,
    private notificationsService: ServerNotificationsService,
    private platformUtilsService: PlatformUtilsServiceAbstraction,
    private keyService: KeyServiceAbstraction,
    private nativeMessagingService: NativeMessagingService,
    private themingService: AbstractThemingService,
    private encryptService: EncryptService,
    private unlockService: UnlockService,
    private accountService: AccountService,
    private tokenService: TokenService,
    private versionService: VersionService,
    private sshAgentService: SshAgentService,
    private autofillService: DesktopAutofillService,
    private autotypeMvpService: DesktopAutotypeMvpService,
    private sdkLoadService: SdkLoadService,
    private ipcService: IpcService,
    private sharedUnlockPeerService: SharedUnlockPeerService,
    private biometricMessageHandlerService: BiometricMessageHandlerService,
    private biometricsService: BiometricsService,
    private legacyCompatKeyService: LegacyCompatKeyService,
    @Inject(DOCUMENT) private document: Document,
    private readonly migrationRunner: MigrationRunner,
    private serverCommunicationConfigService: ServerCommunicationConfigService,
    private updateRestartService: UpdateRestartService,
    private logService: LogService,
    private automationDriver: AutomationDriver,
  ) {}

  init() {
    return async () => {
      await this.sdkLoadService.loadAndInit();
      await this.ipcService.init();
      await this.biometricsService.setUnlockService(this.unlockService);
      await this.sshAgentService.init();
      this.nativeMessagingService.init();
      await this.migrationRunner.waitForCompletion(); // Desktop will run migrations in the main process

      const accounts = await firstValueFrom(this.accountService.accounts$);
      const userIds = Object.keys(accounts) as UserId[];
      await this.tokenService.cleanupTokenStorage(userIds);

      // For each acct, we must await the process of unlocking with the never-lock key
      // if it is set, to avoid race conditions of any code trying to access the user key
      // from mem. A failure to unlock one account leaves that account locked rather than
      // failing app initialization for every other account.
      await Promise.all(
        userIds.map(async (userId) => {
          try {
            await this.unlockService.unlockWithAutoUnlockKey(userId);
          } catch (e) {
            this.logService.error("[InitService] Failed to auto-unlock user on startup", e);
          }
        }),
      );

      await this.serverCommunicationConfigService.init();
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.syncService.fullSync(true);
      await this.vaultTimeoutService.init(true);
      await (this.i18nService as I18nRendererService).init();
      (this.eventUploadService as EventUploadService).init(true);
      this.twoFactorService.init();
      this.notificationsService.startListening();
      const htmlEl = this.win.document.documentElement;
      htmlEl.classList.add("os_" + this.platformUtilsService.getDeviceString());
      this.themingService.applyThemeChangesTo(this.document);

      this.versionService.init();
      this.updateRestartService.init();

      const containerService = new ContainerService(
        this.keyService,
        this.encryptService,
        this.legacyCompatKeyService,
      );
      containerService.attachToGlobal(this.win);
      this.automationDriver.attachToGlobal(this.win);

      await this.sharedUnlockPeerService.start();
      await this.biometricMessageHandlerService.init();
      await this.autofillService.init();
      await this.autotypeMvpService.init();
    };
  }
}
