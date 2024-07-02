import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { concatMap, firstValueFrom, Subject, takeUntil } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationConnectionType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationConnectionResponse } from "@bitwarden/common/admin-console/models/response/organization-connection.response";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { BillingSyncConfigApi } from "@bitwarden/common/billing/models/api/billing-sync-config.api";
import { SelfHostedOrganizationSubscriptionView } from "@bitwarden/common/billing/models/view/self-hosted-organization-subscription.view";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";

import { BillingSyncKeyComponent } from "./billing-sync-key.component";

enum LicenseOptions {
  SYNC = 0,
  UPLOAD = 1,
}

@Component({
  templateUrl: "organization-subscription-selfhost.component.html",
})
export class OrganizationSubscriptionSelfhostComponent implements OnInit, OnDestroy {
  subscription: SelfHostedOrganizationSubscriptionView;
  organizationId: string;
  userOrg: Organization;
  cloudWebVaultUrl: string;
  showAutomaticSyncAndManualUpload: boolean;

  licenseOptions = LicenseOptions;
  form = new FormGroup({
    updateMethod: new FormControl(LicenseOptions.UPLOAD),
  });

  disableLicenseSyncControl = false;

  firstLoaded = false;
  loading = false;

  private _existingBillingSyncConnection: OrganizationConnectionResponse<BillingSyncConfigApi>;

  private destroy$ = new Subject<void>();

  set existingBillingSyncConnection(value: OrganizationConnectionResponse<BillingSyncConfigApi>) {
    this._existingBillingSyncConnection = value;

    this.form
      .get("updateMethod")
      .setValue(this.billingSyncEnabled ? LicenseOptions.SYNC : LicenseOptions.UPLOAD);
  }

  get existingBillingSyncConnection() {
    return this._existingBillingSyncConnection;
  }

  get billingSyncEnabled() {
    return this.existingBillingSyncConnection?.enabled;
  }

  /**
   * Render the subscription as expired.
   */
  get showAsExpired() {
    return this.subscription.hasSeparateGracePeriod
      ? this.subscription.isExpiredWithoutGracePeriod
      : this.subscription.isExpiredAndOutsideGracePeriod;
  }

  constructor(
    private messagingService: MessagingService,
    private apiService: ApiService,
    private organizationService: OrganizationService,
    private route: ActivatedRoute,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private environmentService: EnvironmentService,
    private dialogService: DialogService,
  ) {}

  async ngOnInit() {
    this.cloudWebVaultUrl = await firstValueFrom(this.environmentService.cloudWebVaultUrl$);

    this.route.params
      .pipe(
        concatMap(async (params) => {
          this.organizationId = params.organizationId;
          await this.load();
          await this.loadOrganizationConnection();
          this.firstLoaded = true;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async load() {
    if (this.loading) {
      return;
    }
    this.loading = true;
    this.userOrg = await this.organizationService.get(this.organizationId);
    this.showAutomaticSyncAndManualUpload =
      this.userOrg.productTierType == ProductTierType.Families ? false : true;
    if (this.userOrg.canViewSubscription) {
      const subscriptionResponse = await this.organizationApiService.getSubscription(
        this.organizationId,
      );
      this.subscription = new SelfHostedOrganizationSubscriptionView(subscriptionResponse);
    }

    this.loading = false;
  }

  async loadOrganizationConnection() {
    if (!this.firstLoaded) {
      const cloudCommunicationEnabled = await this.apiService.getCloudCommunicationsEnabled();
      this.disableLicenseSyncControl = !cloudCommunicationEnabled;
    }

    if (this.disableLicenseSyncControl) {
      return;
    }

    this.existingBillingSyncConnection = await this.apiService.getOrganizationConnection(
      this.organizationId,
      OrganizationConnectionType.CloudBillingSync,
      BillingSyncConfigApi,
    );
  }

  licenseUploaded() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.load();
    this.messagingService.send("updatedOrgLicense");
  }

  manageBillingSyncSelfHosted() {
    BillingSyncKeyComponent.open(this.dialogService, {
      entityId: this.organizationId,
      existingConnectionId: this.existingBillingSyncConnection?.id,
      billingSyncKey: this.existingBillingSyncConnection?.config?.billingSyncKey,
      setParentConnection: (connection: OrganizationConnectionResponse<BillingSyncConfigApi>) => {
        this.existingBillingSyncConnection = connection;
      },
    });
  }

  syncLicense = async () => {
    this.form.get("updateMethod").setValue(LicenseOptions.SYNC);
    await this.organizationApiService.selfHostedSyncLicense(this.organizationId);

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.load();
    await this.loadOrganizationConnection();
    this.messagingService.send("updatedOrgLicense");
    this.platformUtilsService.showToast("success", null, this.i18nService.t("licenseSyncSuccess"));
  };

  get billingSyncSetUp() {
    return this.existingBillingSyncConnection?.id != null;
  }

  get updateMethod() {
    return this.form.get("updateMethod").value;
  }

  get lastLicenseSync() {
    return this.existingBillingSyncConnection?.config?.lastLicenseSync;
  }
}
