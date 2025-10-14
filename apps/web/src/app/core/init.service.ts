import { DOCUMENT } from "@angular/common";
import { Inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { EventUploadService as EventUploadServiceAbstraction } from "@bitwarden/common/abstractions/event/event-upload.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TwoFactorService as TwoFactorServiceAbstraction } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { DefaultVaultTimeoutService } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { ContainerService } from "@bitwarden/common/platform/services/container.service";
import { MigrationRunner } from "@bitwarden/common/platform/services/migration-runner";
import { UserAutoUnlockKeyService } from "@bitwarden/common/platform/services/user-auto-unlock-key.service";
import { EventUploadService } from "@bitwarden/common/services/event/event-upload.service";
import { TaskService } from "@bitwarden/common/vault/tasks";
import { KeyService as KeyServiceAbstraction } from "@bitwarden/key-management";

import { VersionService } from "../platform/version.service";

@Injectable()
export class InitService {
  constructor(
    @Inject(WINDOW) private win: Window,
    private serverNotificationsService: ServerNotificationsService,
    private vaultTimeoutService: DefaultVaultTimeoutService,
    private i18nService: I18nServiceAbstraction,
    private eventUploadService: EventUploadServiceAbstraction,
    private twoFactorService: TwoFactorServiceAbstraction,
    private keyService: KeyServiceAbstraction,
    private themingService: AbstractThemingService,
    private encryptService: EncryptService,
    private userAutoUnlockKeyService: UserAutoUnlockKeyService,
    private accountService: AccountService,
    private versionService: VersionService,
    private ipcService: IpcService,
    private sdkLoadService: SdkLoadService,
    private taskService: TaskService,
    private configService: ConfigService,
    private readonly migrationRunner: MigrationRunner,
    @Inject(DOCUMENT) private document: Document,
  ) {}

  init() {
    return async () => {
      await this.sdkLoadService.loadAndInit();
      await this.migrationRunner.run();

      this.configService.serverConfig$.subscribe((newConfig) => {
        if (newConfig != null) {
          this.encryptService.setDisableType0Decryption(
            newConfig.featureStates[FeatureFlag.PM25174_DisableType0Decryption] === true,
          );
        }
      });

      const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
      if (activeAccount) {
        // If there is an active account, we must await the process of setting the user key in memory
        // if the auto user key is set to avoid race conditions of any code trying to access the user key from mem.
        await this.userAutoUnlockKeyService.setUserKeyInMemoryIfAutoUserKeySet(activeAccount.id);
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
      void this.ipcService.init();
      this.taskService.listenForTaskNotifications();

      const containerService = new ContainerService(this.keyService, this.encryptService);
      containerService.attachToGlobal(this.win);
    };
  }
}
