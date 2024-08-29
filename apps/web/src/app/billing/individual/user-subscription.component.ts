import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, lastValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { SubscriptionResponse } from "@bitwarden/common/billing/models/response/subscription.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import {
  AdjustStorageDialogResult,
  openAdjustStorageDialog,
} from "../shared/adjust-storage.component";
import {
  OffboardingSurveyDialogResultType,
  openOffboardingSurvey,
} from "../shared/offboarding-survey.component";
import { UpdateLicenseDialogComponent } from "../shared/update-license-dialog.component";
import { UpdateLicenseDialogResult } from "../shared/update-license-types";

@Component({
  templateUrl: "user-subscription.component.html",
})
export class UserSubscriptionComponent implements OnInit {
  loading = false;
  firstLoaded = false;
  adjustStorageAdd = true;
  showUpdateLicense = false;
  sub: SubscriptionResponse;
  selfHosted = false;
  cloudWebVaultUrl: string;
  enableTimeThreshold: boolean;

  cancelPromise: Promise<any>;
  reinstatePromise: Promise<any>;
  protected enableTimeThreshold$ = this.configService.getFeatureFlag$(
    FeatureFlag.EnableTimeThreshold,
  );

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
    private configService: ConfigService,
  ) {
    this.selfHosted = platformUtilsService.isSelfHost();
  }

  async ngOnInit() {
    this.cloudWebVaultUrl = await firstValueFrom(this.environmentService.cloudWebVaultUrl$);
    await this.load();
    this.enableTimeThreshold = await firstValueFrom(this.enableTimeThreshold$);
    this.firstLoaded = true;
  }

  async load() {
    if (this.loading) {
      return;
    }

    if (await firstValueFrom(this.billingAccountProfileStateService.hasPremiumPersonally$)) {
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
    const dialogRef = openAdjustStorageDialog(this.dialogService, {
      data: {
        storageGbPrice: 4,
        add: add,
      },
    });
    const result = await lastValueFrom(dialogRef.closed);
    if (result === AdjustStorageDialogResult.Adjusted) {
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

  get storageProgressWidth() {
    return this.storagePercentage < 5 ? 5 : 0;
  }

  get title(): string {
    return this.i18nService.t(this.selfHosted ? "subscription" : "premiumMembership");
  }
}
