import { DOCUMENT } from "@angular/common";
import { Inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { EventUploadService as EventUploadServiceAbstraction } from "@bitwarden/common/abstractions/event/event-upload.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TwoFactorService as TwoFactorServiceAbstraction } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { CryptoService as CryptoServiceAbstraction } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService as PlatformUtilsServiceAbstraction } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService as StateServiceAbstraction } from "@bitwarden/common/platform/abstractions/state.service";
import { NotificationsService } from "@bitwarden/common/platform/notifications";
import { ContainerService } from "@bitwarden/common/platform/services/container.service";
import { UserAutoUnlockKeyService } from "@bitwarden/common/platform/services/user-auto-unlock-key.service";
import { SyncService as SyncServiceAbstraction } from "@bitwarden/common/platform/sync";
import { EventUploadService } from "@bitwarden/common/services/event/event-upload.service";
import { VaultTimeoutService } from "@bitwarden/common/services/vault-timeout/vault-timeout.service";
import { UserId } from "@bitwarden/common/types/guid";

import { I18nRendererService } from "../../platform/services/i18n.renderer.service";
import { NativeMessagingService } from "../../services/native-messaging.service";

@Injectable()
export class InitService {
  constructor(
    @Inject(WINDOW) private win: Window,
    private syncService: SyncServiceAbstraction,
    private vaultTimeoutService: VaultTimeoutService,
    private i18nService: I18nServiceAbstraction,
    private eventUploadService: EventUploadServiceAbstraction,
    private twoFactorService: TwoFactorServiceAbstraction,
    private notificationsService: NotificationsService,
    private platformUtilsService: PlatformUtilsServiceAbstraction,
    private stateService: StateServiceAbstraction,
    private cryptoService: CryptoServiceAbstraction,
    private nativeMessagingService: NativeMessagingService,
    private themingService: AbstractThemingService,
    private encryptService: EncryptService,
    private userAutoUnlockKeyService: UserAutoUnlockKeyService,
    private accountService: AccountService,
    @Inject(DOCUMENT) private document: Document,
  ) {}

  init() {
    return async () => {
      this.nativeMessagingService.init();
      await this.stateService.init({ runMigrations: false }); // Desktop will run them in main process

      const accounts = await firstValueFrom(this.accountService.accounts$);
      const setUserKeyInMemoryPromises = [];
      for (const userId of Object.keys(accounts) as UserId[]) {
        // For each acct, we must await the process of setting the user key in memory
        // if the auto user key is set to avoid race conditions of any code trying to access
        // the user key from mem.
        setUserKeyInMemoryPromises.push(
          this.userAutoUnlockKeyService.setUserKeyInMemoryIfAutoUserKeySet(userId),
        );
      }
      await Promise.all(setUserKeyInMemoryPromises);

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

      const containerService = new ContainerService(this.cryptoService, this.encryptService);
      containerService.attachToGlobal(this.win);
    };
  }
}
