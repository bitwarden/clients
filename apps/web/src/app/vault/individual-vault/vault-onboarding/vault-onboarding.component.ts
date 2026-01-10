// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  OnDestroy,
  SimpleChanges,
  OnChanges,
} from "@angular/core";
import { Subject, takeUntil, Observable, firstValueFrom, fromEvent, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { VaultMessages } from "@bitwarden/common/vault/enums/vault-messages.enum";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { LinkModule } from "@bitwarden/components";

import { OnboardingModule } from "../../../shared/components/onboarding/onboarding.module";

import { VaultOnboardingService as VaultOnboardingServiceAbstraction } from "./services/abstraction/vault-onboarding.service";
import { VaultOnboardingService, VaultOnboardingTasks } from "./services/vault-onboarding.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  imports: [OnboardingModule, CommonModule, JslibModule, LinkModule],
  providers: [
    {
      provide: VaultOnboardingServiceAbstraction,
      useClass: VaultOnboardingService,
    },
  ],
  selector: "app-vault-onboarding",
  templateUrl: "vault-onboarding.component.html",
})
export class VaultOnboardingComponent implements OnInit, OnChanges, OnDestroy {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() ciphers: CipherViewLike[];
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() orgs: Organization[];
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onAddCipher = new EventEmitter<CipherType>();

  extensionUrl: string;
  isIndividualPolicyVault: boolean;
  private destroy$ = new Subject<void>();
  isNewAccount: boolean;
  private readonly onboardingReleaseDate = new Date("2024-04-02");

  protected currentTasks: VaultOnboardingTasks;

  protected onboardingTasks$: Observable<VaultOnboardingTasks>;
  protected showOnboarding = false;

  private activeId: UserId;
  constructor(
    protected platformUtilsService: PlatformUtilsService,
    protected policyService: PolicyService,
    private apiService: ApiService,
    private vaultOnboardingService: VaultOnboardingServiceAbstraction,
    private accountService: AccountService,
  ) {}

  async ngOnInit() {
    this.activeId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.onboardingTasks$ = this.vaultOnboardingService.vaultOnboardingState$(this.activeId);

    await this.setOnboardingTasks();
    this.setInstallExtLink();
    this.individualVaultPolicyCheck();
    this.checkForBrowserExtension();
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (this.showOnboarding && changes?.ciphers) {
      const currentTasks = await firstValueFrom(this.onboardingTasks$);
      const updatedTasks = {
        createAccount: true,
        importData: this.ciphers.length > 0,
        installExtension: currentTasks.installExtension,
      };
      await this.vaultOnboardingService.setVaultOnboardingTasks(this.activeId, updatedTasks);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  checkForBrowserExtension() {
    if (this.showOnboarding) {
      fromEvent<MessageEvent>(window, "message")
        .pipe(takeUntil(this.destroy$))
        .subscribe((event) => {
          void this.getMessages(event);
        });

      window.postMessage({ command: VaultMessages.checkBwInstalled });
    }
  }

  async getMessages(event: any) {
    if (event.data.command === VaultMessages.HasBwInstalled && this.showOnboarding) {
      const currentTasks = await firstValueFrom(this.onboardingTasks$);
      const updatedTasks = {
        createAccount: currentTasks.createAccount,
        importData: currentTasks.importData,
        installExtension: true,
      };
      await this.vaultOnboardingService.setVaultOnboardingTasks(this.activeId, updatedTasks);
    }
  }

  async checkCreationDate() {
    const userProfile = await this.apiService.getProfile();
    const profileCreationDate = new Date(userProfile.creationDate);

    this.isNewAccount = this.onboardingReleaseDate < profileCreationDate ? true : false;

    if (!this.isNewAccount) {
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
      const freshStart = {
        createAccount: true,
        importData: this.ciphers?.length > 0,
        installExtension: false,
      };
      await this.saveCompletedTasks(freshStart);
    } else if (currentTasks) {
      this.showOnboarding = Object.values(currentTasks).includes(false);
    }

    if (this.showOnboarding) {
      await this.checkCreationDate();
    }
  }

  private async saveCompletedTasks(vaultTasks: VaultOnboardingTasks) {
    this.showOnboarding = Object.values(vaultTasks).includes(false);
    await this.vaultOnboardingService.setVaultOnboardingTasks(this.activeId, vaultTasks);
  }

  individualVaultPolicyCheck() {
    this.accountService.activeAccount$
      .pipe(
        getUserId,
        switchMap((userId) =>
          this.policyService.policyAppliesToUser$(PolicyType.OrganizationDataOwnership, userId),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((data) => {
        this.isIndividualPolicyVault = data;
      });
  }

  emitToAddCipher() {
    this.onAddCipher.emit(CipherType.Login);
  }

  setInstallExtLink() {
    if (this.platformUtilsService.isChrome()) {
      this.extensionUrl =
        "https://chromewebstore.google.com/detail/bitwarden-password-manage/nngceckbapebfimnlniiiahkandclblb";
    } else if (this.platformUtilsService.isFirefox()) {
      this.extensionUrl =
        "https://addons.mozilla.org/en-US/firefox/addon/bitwarden-password-manager/";
    } else if (this.platformUtilsService.isSafari()) {
      this.extensionUrl = "https://apps.apple.com/us/app/bitwarden/id1352778147?mt=12";
    } else if (this.platformUtilsService.isOpera()) {
      this.extensionUrl =
        "https://addons.opera.com/extensions/details/bitwarden-free-password-manager/";
    } else if (this.platformUtilsService.isEdge()) {
      this.extensionUrl =
        "https://microsoftedge.microsoft.com/addons/detail/jbkfoedolllekgbhcbcoahefnbanhhlh";
    } else {
      this.extensionUrl = "https://bitwarden.com/download/#downloads-web-browser";
    }
  }

  navigateToExtension() {
    window.open(this.extensionUrl, "_blank");
  }
}
