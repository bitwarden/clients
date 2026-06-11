import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  OnDestroy,
  OnInit,
  signal,
  untracked,
} from "@angular/core";
import { Subject, takeUntil, Observable, firstValueFrom, fromEvent, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { VaultMessages } from "@bitwarden/common/vault/enums/vault-messages.enum";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { I18nPipe } from "@bitwarden/ui-common";

import { OnboardingTaskComponent } from "../../components/onboarding/onboarding-task.component";
import { OnboardingComponent } from "../../components/onboarding/onboarding.component";

import { VaultOnboardingService as VaultOnboardingServiceAbstraction } from "./services/abstraction/vault-onboarding.service";
import { VaultOnboardingService, VaultOnboardingTasks } from "./services/vault-onboarding.service";

@Component({
  imports: [OnboardingComponent, OnboardingTaskComponent, CommonModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: VaultOnboardingServiceAbstraction,
      useClass: VaultOnboardingService,
    },
  ],
  selector: "app-vault-onboarding",
  templateUrl: "vault-onboarding.component.html",
})
export class VaultOnboardingComponent implements OnInit, OnDestroy {
  protected readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly apiService = inject(ApiService);
  private readonly vaultOnboardingService = inject(VaultOnboardingServiceAbstraction);
  private readonly accountService = inject(AccountService);

  readonly ciphers = input<CipherViewLike[]>();

  readonly extensionUrl = signal("");
  private readonly destroy$ = new Subject<void>();
  protected readonly isNewAccount = signal(false);
  private readonly onboardingReleaseDate = new Date("2024-04-02");

  private readonly activeId$ = this.accountService.activeAccount$.pipe(getUserId);
  protected readonly onboardingTasks$: Observable<VaultOnboardingTasks | null> =
    this.activeId$.pipe(switchMap((id) => this.vaultOnboardingService.vaultOnboardingState$(id)));
  protected readonly showOnboarding = signal(false);

  constructor() {
    effect(() => {
      const ciphers = this.ciphers();
      if (!this.showOnboarding() || ciphers === undefined) {
        return;
      }
      untracked(() => {
        void this.syncImportData(ciphers);
      });
    });
  }

  async ngOnInit() {
    await this.setOnboardingTasks();
    this.setInstallExtLink();
    this.checkForBrowserExtension();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async syncImportData(ciphers: CipherViewLike[]) {
    const currentTasks = await firstValueFrom(this.onboardingTasks$);
    if (currentTasks == null) {
      return;
    }
    await this.saveCompletedTasks({
      createAccount: true,
      importData: ciphers.length > 0,
      installExtension: currentTasks.installExtension,
    });
  }

  checkForBrowserExtension() {
    if (this.showOnboarding()) {
      fromEvent<MessageEvent>(window, "message")
        .pipe(takeUntil(this.destroy$))
        .subscribe((event) => {
          void this.getMessages(event);
        });

      window.postMessage({ command: VaultMessages.checkBwInstalled });
    }
  }

  async getMessages(event: {
    data: { command: (typeof VaultMessages)[keyof typeof VaultMessages] };
  }) {
    if (event.data.command === VaultMessages.HasBwInstalled && this.showOnboarding()) {
      const currentTasks = await firstValueFrom(this.onboardingTasks$);
      if (currentTasks == null) {
        return;
      }
      await this.saveCompletedTasks({
        createAccount: currentTasks.createAccount,
        importData: currentTasks.importData,
        installExtension: true,
      });
    }
  }

  async checkCreationDate() {
    const userProfile = await this.apiService.getProfile();
    const profileCreationDate = new Date(userProfile.creationDate);

    this.isNewAccount.set(this.onboardingReleaseDate < profileCreationDate);

    if (!this.isNewAccount()) {
      await this.hideOnboarding();
    }
  }

  protected async hideOnboarding() {
    await this.saveCompletedTasks({
      createAccount: true,
      importData: true,
      installExtension: true,
    });
  }

  async setOnboardingTasks() {
    const currentTasks = await firstValueFrom(this.onboardingTasks$);
    if (currentTasks == null) {
      await this.saveCompletedTasks({
        createAccount: true,
        importData: (this.ciphers()?.length ?? 0) > 0,
        installExtension: false,
      });
    } else {
      this.showOnboarding.set(Object.values(currentTasks).includes(false));
    }

    if (this.showOnboarding()) {
      await this.checkCreationDate();
    }
  }

  private async saveCompletedTasks(vaultTasks: VaultOnboardingTasks) {
    this.showOnboarding.set(Object.values(vaultTasks).includes(false));
    const activeId = await firstValueFrom(this.activeId$);
    await this.vaultOnboardingService.setVaultOnboardingTasks(activeId, vaultTasks);
  }

  setInstallExtLink() {
    if (this.platformUtilsService.isChrome()) {
      this.extensionUrl.set(
        "https://chromewebstore.google.com/detail/bitwarden-password-manager/nngceckbapebfimnlniiiahkandclblb",
      );
    } else if (this.platformUtilsService.isFirefox()) {
      this.extensionUrl.set(
        "https://addons.mozilla.org/en-US/firefox/addon/bitwarden-password-manager/",
      );
    } else if (this.platformUtilsService.isSafari()) {
      this.extensionUrl.set("https://apps.apple.com/us/app/bitwarden/id1352778147?mt=12");
    } else if (this.platformUtilsService.isOpera()) {
      this.extensionUrl.set(
        "https://addons.opera.com/extensions/details/bitwarden-free-password-manager/",
      );
    } else if (this.platformUtilsService.isEdge()) {
      this.extensionUrl.set(
        "https://microsoftedge.microsoft.com/addons/detail/jbkfoedolllekgbhcbcoahefnbanhhlh",
      );
    } else {
      this.extensionUrl.set("https://bitwarden.com/download/#downloads-web-browser");
    }
  }

  navigateToExtension() {
    window.open(this.extensionUrl(), "_blank");
  }
}
