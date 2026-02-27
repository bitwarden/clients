// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationApiKeyType } from "@bitwarden/common/admin-console/enums";
import { OrganizationApiKeyRequest } from "@bitwarden/common/admin-console/models/request/organization-api-key.request";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { ApiKeyResponse } from "@bitwarden/common/auth/models/response/api-key.response";
import { Verification } from "@bitwarden/common/auth/types/verification";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DIALOG_DATA, DialogService, ToastService } from "@bitwarden/components";

export interface BillingSyncApiModalData {
  organizationId: string;
  hasBillingToken: boolean;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "billing-sync-api-key.component.html",
  standalone: false,
})
export class BillingSyncApiKeyComponent {
  protected organizationId: string;
  protected hasBillingToken: boolean;

  protected formGroup = new FormGroup({
    verification: new FormControl<Verification>(null, Validators.required),
  });

  showRotateScreen: boolean;
  clientSecret?: string;
  keyRevisionDate?: Date;
  lastSyncDate?: Date;

  constructor(
    @Inject(DIALOG_DATA) protected data: BillingSyncApiModalData,
    private userVerificationService: UserVerificationService,
    private apiService: ApiService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private logService: LogService,
    private toastService: ToastService,
  ) {
    this.organizationId = data.organizationId;
    this.hasBillingToken = data.hasBillingToken;
  }

  copy() {
    this.platformUtilsService.copyToClipboard(this.clientSecret);
  }

  submit = async () => {
    try {
      const request = this.userVerificationService
        .buildRequest(this.formGroup.value.verification, OrganizationApiKeyRequest)
        .then((request) => {
          request.type = OrganizationApiKeyType.BillingSync;
          return request;
        });

      if (this.showRotateScreen) {
        const response = await request.then((request) => {
          return this.organizationApiService.rotateApiKey(this.organizationId, request);
        });
        await this.load(response);
        this.showRotateScreen = false;
        this.toastService.showToast({
          variant: "success",
          title: null,
          message: this.i18nService.t("billingSyncApiKeyRotated"),
        });
      } else {
        const response = await request.then((request) => {
          return this.organizationApiService.getOrCreateApiKey(this.organizationId, request);
        });
        await this.load(response);
      }
    } catch (e) {
      this.logService.error(e);
      throw e;
    }
  };

  async load(response: ApiKeyResponse) {
    this.clientSecret = response.apiKey;
    this.keyRevisionDate = response.revisionDate;
    this.hasBillingToken = true;
    const syncStatus = await this.apiService.getSponsorshipSyncStatus(this.organizationId);
    this.lastSyncDate = syncStatus.lastSyncDate;
  }

  cancelRotate() {
    this.showRotateScreen = false;
  }

  rotateToken() {
    this.showRotateScreen = true;
  }

  private dayDiff(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  get submitButtonText(): string {
    if (this.showRotateScreen) {
      return this.i18nService.t("rotateToken");
    }

    return this.i18nService.t(this.hasBillingToken ? "continue" : "generateToken");
  }

  get showLastSyncText(): boolean {
    // If the keyRevisionDate is later than the lastSyncDate we need to show
    // a warning that they need to put the billing sync key in their self hosted install
    return this.lastSyncDate && this.lastSyncDate > this.keyRevisionDate;
  }

  get showAwaitingSyncText(): boolean {
    return this.lastSyncDate && this.lastSyncDate <= this.keyRevisionDate;
  }

  get daysBetween(): number {
    return this.dayDiff(this.keyRevisionDate, new Date());
  }

  static open(dialogService: DialogService, data: BillingSyncApiModalData) {
    return dialogService.open(BillingSyncApiKeyComponent, { data });
  }
}
