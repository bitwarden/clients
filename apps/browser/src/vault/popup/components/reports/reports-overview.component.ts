import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";
import { firstValueFrom, map, shareReplay, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import {
  BillingAccountProfileStateService,
  BillingApiServiceAbstraction,
} from "@bitwarden/common/billing/abstractions";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherViewLikeUtils } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import {
  ButtonModule,
  IconTileComponent,
  ProgressBarComponent,
  TypographyModule,
} from "@bitwarden/components";
import { BILLING_DISK, KeyDefinition, StateProvider } from "@bitwarden/state";
import { DarkImageSourceDirective } from "@bitwarden/vault";

import { CurrentAccountComponent } from "../../../../auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "../../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";
import { HealthIntroService } from "../../services/health-intro.service";
import { PersonalVaultAlertService } from "../../services/personal-vault-alert.service";

import { PasswordHealthGaugeComponent } from "./password-health-gauge.component";

const CACHED_PREMIUM_ANNUAL_PRICE = new KeyDefinition<number>(
  BILLING_DISK,
  "cachedPremiumAnnualPrice",
  { deserializer: (value) => value },
);

@Component({
  selector: "app-reports-overview",
  templateUrl: "./reports-overview.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    JslibModule,
    RouterModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CurrentAccountComponent,
    ButtonModule,
    IconTileComponent,
    ProgressBarComponent,
    TypographyModule,
    PasswordHealthGaugeComponent,
    DarkImageSourceDirective,
  ],
})
export class ReportsOverviewComponent implements OnInit {
  private readonly accountService = inject(AccountService);
  private readonly billingService = inject(BillingAccountProfileStateService);
  private readonly alertService = inject(PersonalVaultAlertService);
  private readonly healthIntroService = inject(HealthIntroService);
  private readonly cipherService = inject(CipherService);
  private readonly billingApiService = inject(BillingApiServiceAbstraction);
  private readonly environmentService = inject(EnvironmentService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly stateProvider = inject(StateProvider);
  private readonly cachedAnnualPriceState = this.stateProvider.getGlobal(
    CACHED_PREMIUM_ANNUAL_PRICE,
  );

  protected readonly isScanning$ = this.alertService.isScanning$;
  protected readonly summary$ = this.alertService.summary$;
  protected readonly totalCount$ = this.alertService.totalCount$;
  protected readonly progress$ = this.alertService.progress$;
  protected readonly hasSeenIntro$ = this.healthIntroService.healthIntroDismissed$;

  private readonly userId$ = this.accountService.activeAccount$.pipe(getUserId, filterOutNullish());

  protected readonly isPremium$ = this.userId$.pipe(
    switchMap((userId) => this.billingService.hasPremiumFromAnySource$(userId)),
  );

  protected readonly monthlyPrice$ = this.cachedAnnualPriceState.state$.pipe(
    map((annual) => (annual != null ? annual / 12 : null)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private readonly activeCiphers$ = this.userId$.pipe(
    switchMap((userId) => this.cipherService.cipherListViews$(userId)),
    map((ciphers) => ciphers.filter((c) => !CipherViewLikeUtils.isDeleted(c))),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected readonly totalLogins$ = this.activeCiphers$.pipe(
    map((ciphers) => ciphers.filter((c) => CipherViewLikeUtils.getLogin(c) != null).length),
  );

  constructor() {
    // Re-surface excluded items whose risk types are no longer fully covered (e.g. excluded
    // for weak, now also exposed). The effect runs only while the report UI is mounted.
    this.alertService.autoUndismiss$.pipe(takeUntilDestroyed()).subscribe();
  }

  async ngOnInit(): Promise<void> {
    await this.healthIntroService.setHealthBerryDismissed();
    void this.refreshPremiumPrice();
  }

  private async refreshPremiumPrice(): Promise<void> {
    try {
      const plan = await this.billingApiService.getPremiumPlan();
      const annualPrice = plan?.seat?.price;
      if (annualPrice != null) {
        await this.cachedAnnualPriceState.update(() => annualPrice);
      }
    } catch {
      // Keep the previously cached price (if any) so the upsell card stays populated.
    }
  }

  async dismissIntro(): Promise<void> {
    await this.healthIntroService.setHealthIntroDismissed();
  }

  async upgradeToPremium(): Promise<void> {
    const cloudWebVaultUrl = await firstValueFrom(this.environmentService.cloudWebVaultUrl$);
    this.platformUtilsService.launchUri(`${cloudWebVaultUrl}/#/settings/subscription/premium`);
  }
}
