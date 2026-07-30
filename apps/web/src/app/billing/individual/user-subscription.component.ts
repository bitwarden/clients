// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, lastValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { SubscriptionResponse } from "@bitwarden/common/billing/models/response/subscription.response";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import {
  AdjustStorageDialogComponent,
  AdjustStorageDialogResultType,
} from "../shared/adjust-storage-dialog/adjust-storage-dialog.component";
import {
  OffboardingSurveyDialogResultType,
  openOffboardingSurvey,
} from "../shared/offboarding-survey.component";
import { UpdateLicenseDialogComponent } from "../shared/update-license-dialog.component";
import { UpdateLicenseDialogResult } from "../shared/update-license-types";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "user-subscription.component.html",
  standalone: false,
})
export class UserSubscriptionComponent implements OnInit {
  loading = false;
  firstLoaded = false;
  sub: SubscriptionResponse;
  selfHosted = false;
  cloudWebVaultUrl: string;

  cancelPromise: Promise<any>;
  reinstatePromise: Promise<any>;

  constructor(
    private apiService: ApiService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private router: Router,
    private logService: LogService,
    private fileDownloadService: FileDownloadService,
    private dialogService: DialogService,
    private environmentService: EnvironmentService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private toastService: ToastService,
    private accountService: AccountService,
  ) {
    this.selfHosted = this.platformUtilsService.isSelfHost();
  }

  async ngOnInit() {
    this.cloudWebVaultUrl = await firstValueFrom(this.environmentService.cloudWebVaultUrl$);
    await this.load();
    this.firstLoaded = true;
  }

  async load() {
    if (this.loading) {
      return;
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$);
    if (
      await firstValueFrom(this.billingAccountProfileStateService.hasPremiumPersonally$(userId.id))
    ) {
      this.loading = true;
      this.sub = await this.apiService.getUserSubscription();
    } else {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/settings/subscription/premium"]);
      return;
    }

    this.loading = false;
  }

  async reinstate() {
    if (this.loading) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "reinstateSubscription" },
      content: { key: "reinstateConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      this.reinstatePromise = this.apiService.postReinstatePremium();
      await this.reinstatePromise;
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("reinstated"),
      });
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.load();
    } catch (e) {
      this.logService.error(e);
    }
  }

  cancelSubscription = async () => {
    const reference = openOffboardingSurvey(this.dialogService, {
      data: {
        type: "User",
      },
    });

    this.cancelPromise = lastValueFrom(reference.closed);

    const result = await this.cancelPromise;

    if (result === OffboardingSurveyDialogResultType.Closed) {
      return;
    }

    await this.load();
  };

  downloadLicense() {
    if (this.loading) {
      return;
    }

    const licenseString = JSON.stringify(this.sub.license, null, 2);
    this.fileDownloadService.download({
      fileName: "bitwarden_premium_license.json",
      blobData: licenseString,
    });
  }

  updateLicense = async () => {
    if (this.loading) {
      return;
    }
    const dialogRef = UpdateLicenseDialogComponent.open(this.dialogService);
    const result = await lastValueFrom(dialogRef.closed);
    if (result === UpdateLicenseDialogResult.Updated) {
      await this.load();
    }
  };

  adjustStorage = async (add: boolean) => {
    const dialogRef = AdjustStorageDialogComponent.open(this.dialogService, {
      data: {
        price: 4,
        cadence: "year",
        type: add ? "Add" : "Remove",
      },
    });

    const result = await lastValueFrom(dialogRef.closed);

    if (result === AdjustStorageDialogResultType.Submitted) {
      await this.load();
    }
  };

  get subscriptionMarkedForCancel() {
    return (
      this.subscription != null && !this.subscription.cancelled && this.subscription.cancelAtEndDate
    );
  }

  get subscription() {
    return this.sub != null ? this.sub.subscription : null;
  }

  get nextInvoice() {
    return this.sub != null ? this.sub.upcomingInvoice : null;
  }

  get storagePercentage() {
    return this.sub != null && this.sub.maxStorageGb
      ? +(100 * (this.sub.storageGb / this.sub.maxStorageGb)).toFixed(2)
      : 0;
  }

  get title(): string {
    return this.i18nService.t(this.selfHosted ? "subscription" : "premiumMembership");
  }

  get subscriptionStatus(): string | null {
    if (!this.subscription) {
      return null;
    } else {
      /*
       Premium users who sign up with PayPal will have their subscription activated by a webhook.
       This is an arbitrary 15-second grace period where we show their subscription as active rather than
       incomplete while we wait for our webhook to process the `invoice.created` event.
      */
      if (this.subscription.status === "incomplete") {
        const periodStartMS = new Date(this.subscription.periodStartDate).getTime();
        const nowMS = new Date().getTime();
        return nowMS - periodStartMS <= 15000
          ? this.i18nService.t("active")
          : this.subscription.status;
      }

      return this.subscription.status;
    }
  }
}
