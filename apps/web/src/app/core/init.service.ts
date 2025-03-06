import { DOCUMENT } from "@angular/common";
import { Inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { EventUploadService as EventUploadServiceAbstraction } from "@bitwarden/common/abstractions/event/event-upload.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TwoFactorService as TwoFactorServiceAbstraction } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { DefaultVaultTimeoutService } from "@bitwarden/common/key-management/vault-timeout";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { StateService as StateServiceAbstraction } from "@bitwarden/common/platform/abstractions/state.service";
import { NotificationsService } from "@bitwarden/common/platform/notifications";
import { ContainerService } from "@bitwarden/common/platform/services/container.service";
import { UserAutoUnlockKeyService } from "@bitwarden/common/platform/services/user-auto-unlock-key.service";
import { EventUploadService } from "@bitwarden/common/services/event/event-upload.service";
import { KeyService as KeyServiceAbstraction } from "@bitwarden/key-management";

import { VersionService } from "../platform/version.service";

@Injectable()
export class InitService {
  constructor(
    @Inject(WINDOW) private win: Window,
    private notificationsService: NotificationsService,
    private vaultTimeoutService: DefaultVaultTimeoutService,
    private i18nService: I18nServiceAbstraction,
    private eventUploadService: EventUploadServiceAbstraction,
    private twoFactorService: TwoFactorServiceAbstraction,
    private stateService: StateServiceAbstraction,
    private keyService: KeyServiceAbstraction,
    private themingService: AbstractThemingService,
    private encryptService: EncryptService,
    private userAutoUnlockKeyService: UserAutoUnlockKeyService,
    private accountService: AccountService,
    private versionService: VersionService,
    private sdkLoadService: SdkLoadService,
    @Inject(DOCUMENT) private document: Document,
  ) {}

  init() {
    return async () => {
      await this.sdkLoadService.loadAndInit();
      await this.stateService.init();

      const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
      if (activeAccount) {
        // If there is an active account, we must await the process of setting the user key in memory
        // if the auto user key is set to avoid race conditions of any code trying to access the user key from mem.
        await this.userAutoUnlockKeyService.setUserKeyInMemoryIfAutoUserKeySet(activeAccount.id);
      }

      this.notificationsService.startListening();
      await this.vaultTimeoutService.init(true);
      await this.i18nService.init();
      (this.eventUploadService as EventUploadService).init(true);
      this.twoFactorService.init();
      const htmlEl = this.win.document.documentElement;
      htmlEl.classList.add("locale_" + this.i18nService.translationLocale);
      this.themingService.applyThemeChangesTo(this.document);
      this.versionService.applyVersionToWindow();

      const containerService = new ContainerService(this.keyService, this.encryptService);
      containerService.attachToGlobal(this.win);
    };
  }
}
