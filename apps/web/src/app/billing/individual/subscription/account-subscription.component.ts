import { ChangeDetectionStrategy, Component, computed, inject, resource } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, lastValueFrom, map } from "rxjs";

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
  OffboardingSurveyDialogResultType,
  openOffboardingSurvey,
} from "@bitwarden/web-vault/app/billing/shared/offboarding-survey.component";

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

  readonly subscription = resource({
    loader: async () => {
      const redirectToPremiumPage = async (): Promise<null> => {
        await this.router.navigate(["/settings/subscription/premium"]);
        return null;
      };
      const account = await firstValueFrom(this.accountService.activeAccount$);
      if (!account) {
        return await redirectToPremiumPage();
      }
      const hasPremiumPersonally = await firstValueFrom(
        this.billingAccountProfileStateService.hasPremiumPersonally$(account.id),
      );
      if (!hasPremiumPersonally) {
        return await redirectToPremiumPage();
      }
      return await this.accountBillingClient.getSubscription();
    },
  });

  readonly subscriptionLoading = computed<boolean>(() => this.subscription.isLoading());

  readonly subscriptionTerminal = computed<Maybe<boolean>>(() => {
    const subscription = this.subscription.value();
    if (subscription) {
      return (
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
      case SubscriptionCardActions.UpgradePlan:
        // TODO: Implement upgrade plan navigation
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
}
