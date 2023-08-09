import { Component, ViewChild, ViewContainerRef } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, lastValueFrom, Subject, switchMap, takeUntil, from } from "rxjs";

import { DialogServiceAbstraction } from "@bitwarden/angular/services/dialog";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";
import { OrganizationUpdateRequest } from "@bitwarden/common/admin-console/models/request/organization-update.request";
import { OrganizationResponse } from "@bitwarden/common/admin-console/models/response/organization.response";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { ApiKeyComponent } from "../../../settings/api-key.component";
import { PurgeVaultComponent } from "../../../settings/purge-vault.component";

import { DeleteOrganizationDialogResult, openDeleteOrganizationDialog } from "./components";

@Component({
  selector: "app-org-account",
  templateUrl: "account.component.html",
})
export class AccountComponent {
  @ViewChild("purgeOrganizationTemplate", { read: ViewContainerRef, static: true })
  purgeModalRef: ViewContainerRef;
  @ViewChild("apiKeyTemplate", { read: ViewContainerRef, static: true })
  apiKeyModalRef: ViewContainerRef;
  @ViewChild("rotateApiKeyTemplate", { read: ViewContainerRef, static: true })
  rotateApiKeyModalRef: ViewContainerRef;

  selfHosted = false;
  canEditSubscription = true;
  loading = true;
  canUseApi = false;
  org: OrganizationResponse;
  formPromise: Promise<OrganizationResponse>;
  taxFormPromise: Promise<unknown>;

  // FormGroup validators taken from server Organization domain object
  protected formGroup = this.formBuilder.group({
    orgName: this.formBuilder.control(
      { value: "", disabled: true },
      {
        validators: [Validators.required, Validators.maxLength(50)],
        updateOn: "change",
      }
    ),
    billingEmail: this.formBuilder.control(
      { value: "", disabled: true },
      { validators: [Validators.required, Validators.email, Validators.maxLength(256)] }
    ),
    businessName: this.formBuilder.control(
      { value: "", disabled: true },
      { validators: [Validators.maxLength(50)] }
    ),
  });

  protected organizationId: string;
  protected publicKeyBuffer: Uint8Array;

  private destroy$ = new Subject<void>();

  constructor(
    private modalService: ModalService,
    private i18nService: I18nService,
    private route: ActivatedRoute,
    private platformUtilsService: PlatformUtilsService,
    private cryptoService: CryptoService,
    private logService: LogService,
    private router: Router,
    private organizationService: OrganizationService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private dialogService: DialogServiceAbstraction,
    private formBuilder: FormBuilder
  ) {}

  async ngOnInit() {
    this.selfHosted = this.platformUtilsService.isSelfHost();

    this.route.parent.parent.params
      .pipe(
        switchMap((params) => {
          return combineLatest([
            // Organization domain
            this.organizationService.get$(params.organizationId),
            // OrganizationResponse for form population
            from(this.organizationApiService.get(params.organizationId)),
            // Organization Public Key
            from(this.organizationApiService.getKeys(params.organizationId)),
          ]);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(([organization, orgResponse, orgKeys]) => {
        // Set domain level organization variables
        this.organizationId = organization.id;
        this.canEditSubscription = organization.canEditSubscription;
        this.canUseApi = organization.useApi;

        // Org Response
        this.org = orgResponse;

        // Public Key Buffer for Org Fingerprint Generation
        this.publicKeyBuffer = Utils.fromB64ToArray(orgKeys?.publicKey);

        // Patch existing values
        this.formGroup.patchValue({
          orgName: this.org.name,
          billingEmail: this.org.billingEmail,
          businessName: this.org.businessName,
        });

        // Update disabled states - reactive forms prefers not using disabled attribute
        if (!this.selfHosted) {
          this.formGroup.get("orgName").enable();
        }

        if (!this.selfHosted || this.canEditSubscription) {
          this.formGroup.get("billingEmail").enable();
          this.formGroup.get("businessName").enable();
        }

        this.loading = false;
      });
  }

  ngOnDestroy(): void {
    // You must first call .next() in order for the notifier to properly close subscriptions using takeUntil
    this.destroy$.next();
    this.destroy$.complete();
  }

  submit = async () => {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }

    const request = new OrganizationUpdateRequest();
    request.name = this.formGroup.value.orgName;
    request.businessName = this.formGroup.value.businessName;
    request.billingEmail = this.formGroup.value.billingEmail;

    // Backfill pub/priv key if necessary
    if (!this.org.hasPublicAndPrivateKeys) {
      const orgShareKey = await this.cryptoService.getOrgKey(this.organizationId);
      const orgKeys = await this.cryptoService.makeKeyPair(orgShareKey);
      request.keys = new OrganizationKeysRequest(orgKeys[0], orgKeys[1].encryptedString);
    }

    this.formPromise = this.organizationApiService.save(this.organizationId, request);
    await this.formPromise;
    this.platformUtilsService.showToast("success", null, this.i18nService.t("organizationUpdated"));
  };

  async deleteOrganization() {
    const dialog = openDeleteOrganizationDialog(this.dialogService, {
      data: {
        organizationId: this.organizationId,
        requestType: "RegularDelete",
      },
    });

    const result = await lastValueFrom(dialog.closed);

    if (result === DeleteOrganizationDialogResult.Deleted) {
      this.router.navigate(["/"]);
    }
  }

  async purgeVault() {
    await this.modalService.openViewRef(PurgeVaultComponent, this.purgeModalRef, (comp) => {
      comp.organizationId = this.organizationId;
    });
  }

  async viewApiKey() {
    await this.modalService.openViewRef(ApiKeyComponent, this.apiKeyModalRef, (comp) => {
      comp.keyType = "organization";
      comp.entityId = this.organizationId;
      comp.postKey = this.organizationApiService.getOrCreateApiKey.bind(
        this.organizationApiService
      );
      comp.scope = "api.organization";
      comp.grantType = "client_credentials";
      comp.apiKeyTitle = "apiKey";
      comp.apiKeyWarning = "apiKeyWarning";
      comp.apiKeyDescription = "apiKeyDesc";
    });
  }

  async rotateApiKey() {
    await this.modalService.openViewRef(ApiKeyComponent, this.rotateApiKeyModalRef, (comp) => {
      comp.keyType = "organization";
      comp.isRotation = true;
      comp.entityId = this.organizationId;
      comp.postKey = this.organizationApiService.rotateApiKey.bind(this.organizationApiService);
      comp.scope = "api.organization";
      comp.grantType = "client_credentials";
      comp.apiKeyTitle = "apiKey";
      comp.apiKeyWarning = "apiKeyWarning";
      comp.apiKeyDescription = "apiKeyRotateDesc";
    });
  }
}
