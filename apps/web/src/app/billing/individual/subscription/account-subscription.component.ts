import { ChangeDetectionStrategy, Component, computed, inject, resource } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, lastValueFrom, map, switchMap, of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import { PersonalSubscriptionPricingTierIds } from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService, TypographyModule } from "@bitwarden/components";
import { Maybe } from "@bitwarden/pricing";
import {
  AdditionalOptionsCardAction,
  AdditionalOptionsCardActions,
  AdditionalOptionsCardComponent,
  MAX_STORAGE_GB,
  Storage,
  StorageCardAction,
  StorageCardActions,
  StorageCardComponent,
  SubscriptionCardAction,
  SubscriptionCardActions,
  SubscriptionCardComponent,
  SubscriptionStatuses,
} from "@bitwarden/subscription";
import { I18nPipe } from "@bitwarden/ui-common";
import { AccountBillingClient } from "@bitwarden/web-vault/app/billing/clients";
import {
  AdjustAccountSubscriptionStorageDialogComponent,
  AdjustAccountSubscriptionStorageDialogParams,
} from "@bitwarden/web-vault/app/billing/individual/subscription/adjust-account-subscription-storage-dialog.component";
import {
  UnifiedUpgradeDialogComponent,
  UnifiedUpgradeDialogStatus,
  UnifiedUpgradeDialogStep,
} from "@bitwarden/web-vault/app/billing/individual/upgrade/unified-upgrade-dialog/unified-upgrade-dialog.component";
import {
  OffboardingSurveyDialogResultType,
  openOffboardingSurvey,
} from "@bitwarden/web-vault/app/billing/shared/offboarding-survey.component";

import {
  PremiumOrgUpgradeDialogComponent,
  PremiumOrgUpgradeDialogParams,
} from "../upgrade/premium-org-upgrade-dialog/premium-org-upgrade-dialog.component";

@Component({
  templateUrl: "./account-subscription.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AdditionalOptionsCardComponent,
    I18nPipe,
    JslibModule,
    StorageCardComponent,
    SubscriptionCardComponent,
    TypographyModule,
  ],
  providers: [AccountBillingClient],
})
export class AccountSubscriptionComponent {
  private accountService = inject(AccountService);
  private activatedRoute = inject(ActivatedRoute);
  private accountBillingClient = inject(AccountBillingClient);
  private billingAccountProfileStateService = inject(BillingAccountProfileStateService);
  private configService = inject(ConfigService);
  private dialogService = inject(DialogService);
  private fileDownloadService = inject(FileDownloadService);
  private i18nService = inject(I18nService);
  private router = inject(Router);
  private subscriptionPricingService = inject(SubscriptionPricingServiceAbstraction);
  private toastService = inject(ToastService);

  readonly account = toSignal(this.accountService.activeAccount$);

  readonly hasPremiumPersonally = toSignal(
    this.accountService.activeAccount$.pipe(
      switchMap((account) => {
        if (!account) {
          return of(false);
        }
        return this.billingAccountProfileStateService.hasPremiumPersonally$(account.id);
      }),
    ),
    { initialValue: false },
  );

  readonly hasPremiumFromAnyOrganization = toSignal(
    this.accountService.activeAccount$.pipe(
      switchMap((account) => {
        if (!account) {
          return of(false);
        }
        return this.billingAccountProfileStateService.hasPremiumFromAnyOrganization$(account.id);
      }),
    ),
    { initialValue: false },
  );

  readonly subscription = resource({
    params: () => ({
      account: this.account(),
    }),
    loader: async ({ params: { account } }) => {
      if (!account) {
        await this.router.navigate(["/settings/subscription/premium"]);
        return null;
      }
      const subscription = await this.accountBillingClient.getSubscription();
      if (!subscription) {
        const hasPremiumFromAnyOrganization = this.hasPremiumFromAnyOrganization();
        await this.router.navigate([
          hasPremiumFromAnyOrganization ? "/vault" : "/settings/subscription/premium",
        ]);
        return null;
      }
      return subscription;
    },
  });

  readonly subscriptionLoading = computed<boolean>(() => this.subscription.isLoading());

  readonly subscriptionTerminal = computed<Maybe<boolean>>(() => {
    const subscription = this.subscription.value();
    if (subscription) {
      return (
        subscription.status === SubscriptionStatuses.Incomplete ||
        subscription.status === SubscriptionStatuses.IncompleteExpired ||
        subscription.status === SubscriptionStatuses.Canceled ||
        subscription.status === SubscriptionStatuses.Unpaid
      );
    }
  });

  readonly subscriptionPendingCancellation = computed<Maybe<boolean>>(() => {
    const subscription = this.subscription.value();
    if (subscription) {
      return (
        (subscription.status === SubscriptionStatuses.Trialing ||
          subscription.status === SubscriptionStatuses.Active) &&
        !!subscription.cancelAt
      );
    }
  });

  readonly storage = computed<Maybe<Storage>>(() => {
    const subscription = this.subscription.value();
    return subscription?.storage;
  });

  readonly purchasedStorage = computed<number | undefined>(() => {
    const subscription = this.subscription.value();
    return subscription?.cart.passwordManager.additionalStorage?.quantity;
  });

  readonly premiumPlan = toSignal(
    this.subscriptionPricingService
      .getPersonalSubscriptionPricingTiers$()
      .pipe(
        map((tiers) =>
          tiers.find((tier) => tier.id === PersonalSubscriptionPricingTierIds.Premium),
        ),
      ),
  );

  readonly premiumStoragePrice = computed<Maybe<number>>(() => {
    const premiumPlan = this.premiumPlan();
    return premiumPlan?.passwordManager.annualPricePerAdditionalStorageGB;
  });

  readonly premiumProvidedStorage = computed<Maybe<number>>(() => {
    const premiumPlan = this.premiumPlan();
    return premiumPlan?.passwordManager.providedStorageGB;
  });

  readonly canAddStorage = computed<Maybe<boolean>>(() => {
    if (this.subscriptionTerminal()) {
      return false;
    }
    const storage = this.storage();
    const premiumProvidedStorage = this.premiumProvidedStorage();
    if (storage && premiumProvidedStorage) {
      const maxAttainableStorage = MAX_STORAGE_GB - premiumProvidedStorage;
      return storage.available < maxAttainableStorage;
    }
  });

  readonly canRemoveStorage = computed<Maybe<boolean>>(() => {
    if (this.subscriptionTerminal()) {
      return false;
    }
    const purchasedStorage = this.purchasedStorage();
    if (!purchasedStorage || purchasedStorage === 0) {
      return false;
    }
    const storage = this.storage();
    if (storage) {
      return storage.available > storage.used;
    }
  });

  readonly canCancelSubscription = computed<Maybe<boolean>>(() => {
    if (this.subscriptionTerminal()) {
      return false;
    }
    return !this.subscriptionPendingCancellation();
  });

  readonly premiumToOrganizationUpgradeEnabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.PM29593_PremiumToOrganizationUpgrade),
    { initialValue: false },
  );

  readonly canUpgradeFromPremium = computed<boolean>(() => {
    // Since account is checked in hasPremiumPersonally, no need to check again here
    const hasPremiumPersonally = this.hasPremiumPersonally();
    const upgradeEnabled = this.premiumToOrganizationUpgradeEnabled();
    return hasPremiumPersonally && upgradeEnabled;
  });

  onSubscriptionCardAction = async (action: SubscriptionCardAction) => {
    switch (action) {
      case SubscriptionCardActions.ContactSupport:
        window.open("https://bitwarden.com/contact/", "_blank");
        break;
      case SubscriptionCardActions.ManageInvoices:
        await this.router.navigate(["../billing-history"], { relativeTo: this.activatedRoute });
        break;
      case SubscriptionCardActions.ReinstateSubscription: {
        const confirmed = await this.dialogService.openSimpleDialog({
          title: { key: "reinstateSubscription" },
          content: { key: "reinstateConfirmation" },
          type: "warning",
        });

        if (!confirmed) {
          return;
        }

        await this.accountBillingClient.reinstateSubscription();
        this.toastService.showToast({
          variant: "success",
          title: "",
          message: this.i18nService.t("reinstated"),
        });
        this.subscription.reload();
        break;
      }
      case SubscriptionCardActions.UpdatePayment:
        await this.router.navigate(["../payment-details"], { relativeTo: this.activatedRoute });
        break;
      case SubscriptionCardActions.Resubscribe: {
        const account = this.account();
        if (!account) {
          return;
        }

        const dialogRef = UnifiedUpgradeDialogComponent.open(this.dialogService, {
          data: {
            account,
            initialStep: UnifiedUpgradeDialogStep.Payment,
            selectedPlan: PersonalSubscriptionPricingTierIds.Premium,
          },
        });

        const result = await lastValueFrom(dialogRef.closed);

        if (result?.status === UnifiedUpgradeDialogStatus.UpgradedToPremium) {
          this.subscription.reload();
        }
        break;
      }
      case SubscriptionCardActions.UpgradePlan:
        await this.openUpgradeDialog();
        break;
    }
  };

  onStorageCardAction = async (action: StorageCardAction) => {
    const data = this.getAdjustStorageDialogParams(action);
    const dialogReference = AdjustAccountSubscriptionStorageDialogComponent.open(
      this.dialogService,
      {
        data,
      },
    );
    const result = await lastValueFrom(dialogReference.closed);
    if (result === "submitted") {
      this.subscription.reload();
    }
  };

  onAdditionalOptionsCardAction = async (action: AdditionalOptionsCardAction) => {
    switch (action) {
      case AdditionalOptionsCardActions.DownloadLicense: {
        const license = await this.accountBillingClient.getLicense();
        const json = JSON.stringify(license, null, 2);
        this.fileDownloadService.download({
          fileName: "bitwarden_premium_license.json",
          blobData: json,
        });
        break;
      }
      case AdditionalOptionsCardActions.CancelSubscription: {
        const dialogReference = openOffboardingSurvey(this.dialogService, {
          data: {
            type: "User",
          },
        });

        const result = await lastValueFrom(dialogReference.closed);

        if (result === OffboardingSurveyDialogResultType.Closed) {
          return;
        }

        this.subscription.reload();
      }
    }
  };

  getAdjustStorageDialogParams = (
    action: StorageCardAction,
  ): Maybe<AdjustAccountSubscriptionStorageDialogParams> => {
    const purchasedStorage = this.purchasedStorage();
    const storagePrice = this.premiumStoragePrice();
    const providedStorage = this.premiumProvidedStorage();

    switch (action) {
      case StorageCardActions.AddStorage: {
        if (storagePrice && providedStorage) {
          return {
            type: "add",
            price: storagePrice,
            provided: providedStorage,
            cadence: "annually",
            existing: purchasedStorage,
          };
        }
        break;
      }
      case StorageCardActions.RemoveStorage: {
        if (purchasedStorage) {
          return {
            type: "remove",
            existing: purchasedStorage,
          };
        }
        break;
      }
    }
  };

  openUpgradeDialog = async (): Promise<void> => {
    const account = this.account();
    if (!account) {
      return;
    }

    const dialogParams: PremiumOrgUpgradeDialogParams = {
      account,
      redirectOnCompletion: true,
    };

    const dialogRef = PremiumOrgUpgradeDialogComponent.open(this.dialogService, {
      data: dialogParams,
    });
    await firstValueFrom(dialogRef.closed);
  };
}
