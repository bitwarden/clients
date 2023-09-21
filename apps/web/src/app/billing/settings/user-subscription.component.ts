import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { SubscriptionResponse } from "@bitwarden/common/billing/models/response/subscription.response";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { DialogService } from "@bitwarden/components";

@Component({
  selector: "app-user-subscription",
  templateUrl: "user-subscription.component.html",
})
export class UserSubscriptionComponent implements OnInit {
  loading = false;
  firstLoaded = false;
  adjustStorageAdd = true;
  showAdjustStorage = false;
  showUpdateLicense = false;
  sub: SubscriptionResponse;
  selfHosted = false;
  cloudWebVaultUrl: string;

  cancelPromise: Promise<any>;
  reinstatePromise: Promise<any>;

  constructor(
    private stateService: StateService,
    private apiService: ApiService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private router: Router,
    private logService: LogService,
    private fileDownloadService: FileDownloadService,
    private dialogService: DialogService,
    private environmentService: EnvironmentService
  ) {
    this.selfHosted = platformUtilsService.isSelfHost();
    this.cloudWebVaultUrl = this.environmentService.getCloudWebVaultUrl();
  }

  async ngOnInit() {
    await this.load();
    this.firstLoaded = true;
  }

  async load() {
    if (this.loading) {
      return;
    }

    if (this.stateService.getHasPremiumPersonally()) {
      this.loading = true;
      this.sub = await this.apiService.getUserSubscription();
    } else {
      this.router.navigate(["/settings/subscription/premium"]);
      return;
    }

    this.loading = false;
  }

  async reinstate() {
    if (this.loading) {
      return;
    }

    if (this.usingInAppPurchase) {
      this.dialogService.openSimpleDialog({
        title: { key: "cancelSubscription" },
        content: { key: "manageSubscriptionFromStore" },
        acceptButtonText: { key: "ok" },
        cancelButtonText: null,
        type: "warning",
      });

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
      this.platformUtilsService.showToast("success", null, this.i18nService.t("reinstated"));
      this.load();
    } catch (e) {
      this.logService.error(e);
    }
  }

  async cancel() {
    if (this.loading) {
      return;
    }

    if (this.usingInAppPurchase) {
      this.dialogService.openSimpleDialog({
        title: { key: "cancelSubscription" },
        content: { key: "manageSubscriptionFromStore" },
        acceptButtonText: { key: "ok" },
        cancelButtonText: null,
        type: "warning",
      });

      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "cancelSubscription" },
      content: { key: "cancelConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      this.cancelPromise = this.apiService.postCancelPremium();
      await this.cancelPromise;
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("canceledSubscription")
      );
      this.load();
    } catch (e) {
      this.logService.error(e);
    }
  }

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

  updateLicense() {
    if (this.loading) {
      return;
    }
    this.showUpdateLicense = true;
  }

  closeUpdateLicense(load: boolean) {
    this.showUpdateLicense = false;
    if (load) {
      this.load();
    }
  }

  adjustStorage(add: boolean) {
    if (this.usingInAppPurchase) {
      this.dialogService.openSimpleDialog({
        title: { key: add ? "addStorage" : "removeStorage" },
        content: { key: "cannotPerformInAppPurchase" },
        acceptButtonText: { key: "ok" },
        cancelButtonText: null,
        type: "warning",
      });

      return;
    }
    this.adjustStorageAdd = add;
    this.showAdjustStorage = true;
  }

  closeStorage(load: boolean) {
    this.showAdjustStorage = false;
    if (load) {
      this.load();
    }
  }

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

  get usingInAppPurchase() {
    return this.sub != null ? this.sub.usingInAppPurchase : false;
  }

  get title(): string {
    return this.i18nService.t(this.selfHosted ? "subscription" : "premiumMembership");
  }
}
