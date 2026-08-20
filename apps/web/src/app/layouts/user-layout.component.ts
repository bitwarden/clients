// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, computed, inject, OnInit, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterModule } from "@angular/router";
import { filter, firstValueFrom, map, Observable, switchMap } from "rxjs";

import { PasswordManagerLogo } from "@bitwarden/assets/svg";
import {
  canAccessEmergencyAccess,
  singleOrganizationPolicyApplies$,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import {
  ChipActionComponent,
  PopoverModule,
  SideNavService,
  SvgModule,
} from "@bitwarden/components";
import { SendPolicyService } from "@bitwarden/send-ui";
import { I18nPipe } from "@bitwarden/ui-common";
import { vaultScopeCommands, VaultNavSectionComponent, VaultScopeType } from "@bitwarden/vault";
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
    VaultNavSectionComponent,
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
  private readonly cipherArchiveService = inject(CipherArchiveService);
  private readonly premiumUpgradePromptService = inject(PremiumUpgradePromptService);

  protected readonly vfo1Enabled: Signal<boolean> = toSignal(
    inject(ConfigService).getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  private readonly userCanArchive = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.cipherArchiveService.userCanArchive$(userId)),
    ),
    { initialValue: true },
  );

  protected readonly showArchivePremiumBadge = computed(() => !this.userCanArchive());

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

  protected readonly trashRoute = vaultScopeCommands({ type: VaultScopeType.Trash });

  private readonly archiveRoute = vaultScopeCommands({ type: VaultScopeType.Archive });

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /**
   * Archive is a button rather than a link (see {@link selectArchive}), so it gets no
   * `routerLinkActive` and has to say for itself when it is the current page.
   *
   * `router.isActive` reads router state rather than a signal, so reading {@link currentUrl} is
   * what ties this to navigation — without it the answer would be computed once and kept.
   */
  protected readonly archiveActive = computed(() => {
    this.currentUrl();
    return this.router.isActive(this.router.createUrlTree(this.archiveRoute), {
      // Only this URL counts as the archive; a scoped vault route must not light it up.
      paths: "exact",
      queryParams: "ignored",
      fragment: "ignored",
      matrixParams: "ignored",
    });
  });

  /**
   * Stays a click handler rather than a `route` binding: a user without premium and without
   * anything archived is offered an upgrade instead of an empty archive.
   */
  protected async selectArchive() {
    if (!this.userCanArchive()) {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const hasArchivedCiphers =
        (await firstValueFrom(this.cipherArchiveService.archivedCiphers$(userId))).length > 0;
      if (!hasArchivedCiphers) {
        await this.premiumUpgradePromptService.promptForPremium();
        return;
      }
    }
    await this.router.navigate(this.archiveRoute);
  }

  protected async promptForPremium() {
    await this.premiumUpgradePromptService.promptForPremium();
  }

  async ngOnInit() {
    document.body.classList.remove("layout_frontend");
    await this.syncService.fullSync(false);
  }
}
