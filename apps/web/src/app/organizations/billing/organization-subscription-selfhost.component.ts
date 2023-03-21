import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { concatMap, takeUntil, Subject } from "rxjs";

import { ModalConfig, ModalService } from "@bitwarden/angular/services/modal.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/abstractions/messaging.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/abstractions/organization/organization.service.abstraction";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { OrganizationConnectionType } from "@bitwarden/common/enums/organizationConnectionType";
import { BillingSyncConfigApi } from "@bitwarden/common/models/api/billing-sync-config.api";
import { Organization } from "@bitwarden/common/models/domain/organization";
import { OrganizationConnectionResponse } from "@bitwarden/common/models/response/organization-connection.response";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/models/response/organization-subscription.response";
import { Guid } from "@bitwarden/common/types/guid";

import {
  BillingSyncKeyComponent,
  BillingSyncKeyModalData,
} from "../../settings/billing-sync-key.component";

enum LicenseOptions {
  SYNC = 0,
  UPLOAD = 1,
}

@Component({
  selector: "app-org-subscription-selfhost",
  templateUrl: "organization-subscription-selfhost.component.html",
})
export class OrganizationSubscriptionSelfhostComponent implements OnInit, OnDestroy {
  sub: OrganizationSubscriptionResponse;
  organizationId: Guid;
  userOrg: Organization;

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

  constructor(
    private modalService: ModalService,
    private messagingService: MessagingService,
    private apiService: ApiService,
    private organizationService: OrganizationService,
    private route: ActivatedRoute,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService
  ) {}

  async ngOnInit() {
    this.route.params
      .pipe(
        concatMap(async (params) => {
          this.organizationId = params.organizationId;
          await this.load();
          await this.loadOrganizationConnection();
          this.firstLoaded = true;
        }),
        takeUntil(this.destroy$)
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
    this.userOrg = this.organizationService.get(this.organizationId);
    if (this.userOrg.canManageBilling) {
      this.sub = await this.organizationApiService.getSubscription(this.organizationId);
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
      BillingSyncConfigApi
    );
  }

  licenseUploaded() {
    this.load();
    this.messagingService.send("updatedOrgLicense");
  }

  manageBillingSyncSelfHosted() {
    const modalConfig: ModalConfig<BillingSyncKeyModalData> = {
      data: {
        entityId: this.organizationId,
        existingConnectionId: this.existingBillingSyncConnection?.id,
        billingSyncKey: this.existingBillingSyncConnection?.config?.billingSyncKey,
        setParentConnection: (connection: OrganizationConnectionResponse<BillingSyncConfigApi>) => {
          this.existingBillingSyncConnection = connection;
        },
      },
    };

    this.modalService.open(BillingSyncKeyComponent, modalConfig);
  }

  syncLicense = async () => {
    this.form.get("updateMethod").setValue(LicenseOptions.SYNC);
    await this.organizationApiService.selfHostedSyncLicense(this.organizationId);

    this.load();
    await this.loadOrganizationConnection();
    this.messagingService.send("updatedOrgLicense");
    this.platformUtilsService.showToast("success", null, this.i18nService.t("licenseSyncSuccess"));
  };

  get billingSyncSetUp() {
    return this.existingBillingSyncConnection?.id != null;
  }

  get isExpired() {
    return this.sub?.expiration != null && new Date(this.sub.expiration) < new Date();
  }

  get updateMethod() {
    return this.form.get("updateMethod").value;
  }

  get lastLicenseSync() {
    return this.existingBillingSyncConnection?.config?.lastLicenseSync;
  }
}
