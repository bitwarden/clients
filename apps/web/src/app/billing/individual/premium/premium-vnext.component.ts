import { CommonModule } from "@angular/common";
import { Component, DestroyRef, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { combineLatest, firstValueFrom, map, Observable, of, shareReplay, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import {
  DialogService,
  ToastService,
  SectionComponent,
  BadgeModule,
  TypographyModule,
  LinkModule,
} from "@bitwarden/components";
import { PricingCardComponent } from "@bitwarden/pricing";
import { I18nPipe } from "@bitwarden/ui-common";

import { SubscriptionPricingService } from "../../services/subscription-pricing.service";
import { BitwardenSubscriber, mapAccountToSubscriber } from "../../types";
import {
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierIds,
} from "../../types/subscription-pricing-tier";
import {
  UnifiedUpgradeDialogComponent,
  UnifiedUpgradeDialogParams,
  UnifiedUpgradeDialogResult,
  UnifiedUpgradeDialogStatus,
  UnifiedUpgradeDialogStep,
} from "../upgrade/unified-upgrade-dialog/unified-upgrade-dialog.component";

@Component({
  templateUrl: "./premium-vnext.component.html",
  standalone: true,
  imports: [
    CommonModule,
    SectionComponent,
    BadgeModule,
    TypographyModule,
    LinkModule,
    I18nPipe,
    PricingCardComponent,
  ],
})
export class PremiumVNextComponent {
  protected hasPremiumFromAnyOrganization$: Observable<boolean>;
  protected hasPremiumPersonally$: Observable<boolean>;
  protected shouldShowNewDesign$: Observable<boolean>;
  protected personalPricingTiers$: Observable<PersonalSubscriptionPricingTier[]>;
  protected premiumCardData$: Observable<{
    tier: PersonalSubscriptionPricingTier | undefined;
    price: number;
    features: string[];
  }>;
  protected familiesCardData$: Observable<{
    tier: PersonalSubscriptionPricingTier | undefined;
    price: number;
    features: string[];
  }>;

  protected subscriber!: BitwardenSubscriber;
  protected isSelfHost = false;
  private destroyRef = inject(DestroyRef);

  constructor(
    private accountService: AccountService,
    private i18nService: I18nService,
    private apiService: ApiService,
    private dialogService: DialogService,
    private platformUtilsService: PlatformUtilsService,
    private syncService: SyncService,
    private toastService: ToastService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private subscriptionPricingService: SubscriptionPricingService,
  ) {
    this.isSelfHost = this.platformUtilsService.isSelfHost();

    this.hasPremiumFromAnyOrganization$ = this.accountService.activeAccount$.pipe(
      switchMap((account) =>
        account
          ? this.billingAccountProfileStateService.hasPremiumFromAnyOrganization$(account.id)
          : of(false),
      ),
    );

    this.hasPremiumPersonally$ = this.accountService.activeAccount$.pipe(
      switchMap((account) =>
        account
          ? this.billingAccountProfileStateService.hasPremiumPersonally$(account.id)
          : of(false),
      ),
    );

    this.accountService.activeAccount$
      .pipe(mapAccountToSubscriber, takeUntilDestroyed(this.destroyRef))
      .subscribe((subscriber) => {
        this.subscriber = subscriber;
      });

    this.shouldShowNewDesign$ = combineLatest([
      this.hasPremiumFromAnyOrganization$,
      this.hasPremiumPersonally$,
    ]).pipe(map(([hasOrgPremium, hasPersonalPremium]) => !hasOrgPremium && !hasPersonalPremium));

    this.personalPricingTiers$ =
      this.subscriptionPricingService.getPersonalSubscriptionPricingTiers$();

    this.premiumCardData$ = this.personalPricingTiers$.pipe(
      map((tiers) => {
        const tier = tiers.find((t) => t.id === PersonalSubscriptionPricingTierIds.Premium);
        return {
          tier,
          price:
            tier?.passwordManager.type === "standalone"
              ? Number((tier.passwordManager.annualPrice / 12).toFixed(2))
              : 0,
          features: tier?.passwordManager.features.map((f) => f.value) || [],
        };
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.familiesCardData$ = this.personalPricingTiers$.pipe(
      map((tiers) => {
        const tier = tiers.find((t) => t.id === PersonalSubscriptionPricingTierIds.Families);
        return {
          tier,
          price:
            tier?.passwordManager.type === "packaged"
              ? Number((tier.passwordManager.annualPrice / 12).toFixed(2))
              : 0,
          features: tier?.passwordManager.features.map((f) => f.value) || [],
        };
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  finalizeUpgrade = async () => {
    await this.apiService.refreshIdentityToken();
    await this.syncService.fullSync(true);
  };

  protected async openUpgradeDialog(planType: "Premium" | "Families"): Promise<void> {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (!account) {
      return;
    }

    const selectedPlan =
      planType === "Premium"
        ? PersonalSubscriptionPricingTierIds.Premium
        : PersonalSubscriptionPricingTierIds.Families;

    const dialogParams: UnifiedUpgradeDialogParams = {
      account,
      initialStep: UnifiedUpgradeDialogStep.Payment,
      selectedPlan: selectedPlan,
      redirectOnCompletion: true,
    };

    const dialogRef = UnifiedUpgradeDialogComponent.open(this.dialogService, {
      data: dialogParams,
    });

    dialogRef.closed
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result: UnifiedUpgradeDialogResult | undefined) => {
        if (
          result?.status === UnifiedUpgradeDialogStatus.UpgradedToPremium ||
          result?.status === UnifiedUpgradeDialogStatus.UpgradedToFamilies
        ) {
          void this.finalizeUpgrade();
        }
      });
  }
}
