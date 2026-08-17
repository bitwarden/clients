// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, computed, inject, OnInit, Signal } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Params, Router, RouterModule } from "@angular/router";
import { firstValueFrom, map, Observable, of, switchMap } from "rxjs";

import { PasswordManagerLogo } from "@bitwarden/assets/svg";
import {
  canAccessEmergencyAccess,
  singleOrganizationPolicyApplies$,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Unassigned } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import {
  ChipActionComponent,
  defaultAvatarColors,
  IconTileComponent,
  isAvatarColor,
  PopoverModule,
  SideNavService,
  SvgModule,
} from "@bitwarden/components";
import { SendPolicyService } from "@bitwarden/send-ui";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  RoutedVaultFilterItemType,
  VaultNavItemType,
  VaultNavItemViewModel,
  VaultNavService,
  VaultsNavViewModel,
} from "@bitwarden/vault";
import { PremiumSubscriptionRoutingService } from "@bitwarden/web-vault/app/billing/individual/services/premium-subscription-routing.service";

import { BillingFreeFamiliesNavItemComponent } from "../billing/shared/billing-free-families-nav-item.component";
import { CoachmarkComponent, CoachmarkService } from "../vault/components/coachmark";

import { WebLayoutModule } from "./web-layout.module";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-user-layout",
  templateUrl: "user-layout.component.html",
  imports: [
    CommonModule,
    RouterModule,
    I18nPipe,
    WebLayoutModule,
    SvgModule,
    ChipActionComponent,
    IconTileComponent,
    BillingFreeFamiliesNavItemComponent,
    PopoverModule,
    CoachmarkComponent,
  ],
})
export class UserLayoutComponent implements OnInit {
  protected readonly logo = PasswordManagerLogo;
  protected readonly showEmergencyAccess: Signal<boolean>;
  protected readonly sendEnabled$: Observable<boolean> = this.sendPolicyService.disableSend$.pipe(
    map((disableSend) => !disableSend),
  );
  protected subscriptionRoute$: Observable<string | null>;

  protected readonly coachmarkService = inject(CoachmarkService);
  protected readonly sideNavService = inject(SideNavService);

  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly vaultNavService = inject(VaultNavService);
  private readonly cipherArchiveService = inject(CipherArchiveService);
  private readonly premiumUpgradePromptService = inject(PremiumUpgradePromptService);

  protected readonly vfo1Enabled: Signal<boolean> = toSignal(
    inject(ConfigService).getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  protected readonly vaultNav: Signal<VaultsNavViewModel | undefined> = toSignal(
    toObservable(this.vfo1Enabled).pipe(
      switchMap((enabled) => (enabled ? this.vaultNavService.viewModel$ : of(undefined))),
    ),
  );

  private readonly activeParams = toSignal(this.activatedRoute.queryParamMap);

  /** The vault filter applied by the current query params. */
  private readonly activeFilter = computed(() => {
    const params = this.activeParams();
    return {
      vaultId: params?.get("vaultId") ?? null,
      type: params?.get("type") ?? null,
      sharedFolderId: params?.get("sharedFolderId") ?? null,
    };
  });

  private readonly userHasPremium = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.cipherArchiveService.userHasPremium$(userId)),
    ),
    { initialValue: true },
  );

  protected readonly showArchivePremiumBadge = computed(() => !this.userHasPremium());

  protected readonly singleOrgPolicyApplies = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => singleOrganizationPolicyApplies$(userId, this.policyService)),
    ),
    { initialValue: true },
  );

  protected readonly importCoachmarkOpen = computed(
    () => this.coachmarkService.activeStepId() === "importData",
  );

  protected readonly reportsCoachmarkOpen = computed(
    () => this.coachmarkService.activeStepId() === "monitorSecurity",
  );

  /** Expand tools nav group when import coachmark is active */
  protected readonly toolsNavGroupOpen = computed(
    () => this.coachmarkService.activeStepId() === "importData",
  );

  constructor(
    private syncService: SyncService,
    private accountService: AccountService,
    private policyService: PolicyService,
    private sendPolicyService: SendPolicyService,
    private premiumSubscriptionRoutingService: PremiumSubscriptionRoutingService,
  ) {
    this.showEmergencyAccess = toSignal(
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => canAccessEmergencyAccess(userId, this.policyService)),
      ),
    );

    this.subscriptionRoute$ = this.premiumSubscriptionRoutingService.getSubscriptionRoute$();
  }

  /**
   * `bit-nav-item` has no query-param input, so vault filters are applied through the router
   * rather than a `route` binding.
   */
  private async navigateToVault(queryParams: Params) {
    await this.router.navigate(["/vault"], {
      queryParams: {
        folderId: null,
        sharedFolderId: null,
        collectionId: null,
        organizationId: null,
        ...queryParams,
      },
      queryParamsHandling: "merge",
    });
  }

  protected async selectVault(vault: VaultNavItemViewModel) {
    await this.navigateToVault({ vaultId: this.vaultIdParam(vault), type: null });
  }

  protected async selectMyItems(vault: VaultNavItemViewModel, collectionId: string) {
    await this.navigateToVault({
      vaultId: this.vaultIdParam(vault),
      sharedFolderId: collectionId,
      type: null,
    });
  }

  protected async selectAllItems() {
    await this.navigateToVault({ vaultId: null, type: null });
  }

  protected async selectItemType(type: RoutedVaultFilterItemType) {
    await this.navigateToVault({ type });
  }

  protected async selectArchive() {
    if (!this.userHasPremium()) {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const hasArchivedCiphers =
        (await firstValueFrom(this.cipherArchiveService.archivedCiphers$(userId))).length > 0;
      if (!hasArchivedCiphers) {
        await this.premiumUpgradePromptService.promptForPremium();
        return;
      }
    }
    await this.selectItemType("archive");
  }

  protected async promptForPremium() {
    await this.premiumUpgradePromptService.promptForPremium();
  }

  protected vaultTileColor(vault: VaultNavItemViewModel): string {
    return isAvatarColor(vault.color) ? defaultAvatarColors[vault.color] : vault.color;
  }

  private vaultIdParam(vault: VaultNavItemViewModel): string {
    return vault.type === VaultNavItemType.Personal ? Unassigned : vault.id;
  }

  private onVaultRoot(f = this.activeFilter()): boolean {
    return this.router.url.split("?")[0] === "/vault" && !f.sharedFolderId && !f.type;
  }

  protected allItemsActive(): boolean {
    const f = this.activeFilter();
    return this.onVaultRoot(f) && !f.vaultId;
  }

  protected vaultActive(vault: VaultNavItemViewModel): boolean {
    const f = this.activeFilter();
    const soleVault = this.vaultNav()?.vaults.length === 1;
    return (
      this.onVaultRoot(f) && (f.vaultId === this.vaultIdParam(vault) || (soleVault && !f.vaultId))
    );
  }

  protected myItemsActive(vault: VaultNavItemViewModel): boolean {
    const f = this.activeFilter();
    return (
      f.vaultId === this.vaultIdParam(vault) && f.sharedFolderId === vault.defaultUserCollectionId
    );
  }

  protected itemTypeActive(type: RoutedVaultFilterItemType): boolean {
    return this.activeFilter().type === type;
  }

  async ngOnInit() {
    document.body.classList.remove("layout_frontend");
    await this.syncService.fullSync(false);
  }
}
