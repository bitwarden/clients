import { Component, ViewChild, ViewContainerRef } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, from, lastValueFrom, of, Subject, switchMap, takeUntil } from "rxjs";

import { ModalService } from "@bitwarden/angular/services/modal.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationCollectionManagementUpdateRequest } from "@bitwarden/common/admin-console/models/request/organization-collection-management-update.request";
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";
import { OrganizationUpdateRequest } from "@bitwarden/common/admin-console/models/request/organization-update.request";
import { OrganizationResponse } from "@bitwarden/common/admin-console/models/response/organization.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { DialogService, SimpleDialogOptions } from "@bitwarden/components";

import { ApiKeyComponent } from "../../../auth/settings/security/api-key.component";
import { PurgeVaultComponent } from "../../../vault/settings/purge-vault.component";

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
  taxFormPromise: Promise<unknown>;

  protected flexibleCollectionsMigrationEnabled$ = this.configService.getFeatureFlag$(
    FeatureFlag.FlexibleCollectionsMigration,
    false,
  );

  flexibleCollectionsV1Enabled$ = this.configService.getFeatureFlag$(
    FeatureFlag.FlexibleCollectionsV1,
    false,
  );

  // FormGroup validators taken from server Organization domain object
  protected formGroup = this.formBuilder.group({
    orgName: this.formBuilder.control(
      { value: "", disabled: true },
      {
        validators: [Validators.required, Validators.maxLength(50)],
        updateOn: "change",
      },
    ),
    billingEmail: this.formBuilder.control(
      { value: "", disabled: true },
      { validators: [Validators.required, Validators.email, Validators.maxLength(256)] },
    ),
    businessName: this.formBuilder.control(
      { value: "", disabled: true },
      { validators: [Validators.maxLength(50)] },
    ),
  });

  protected collectionManagementFormGroup = this.formBuilder.group({
    limitCollectionCreationDeletion: this.formBuilder.control({ value: false, disabled: true }),
    allowAdminAccessToAllCollectionItems: this.formBuilder.control({
      value: false,
      disabled: true,
    }),
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
    private router: Router,
    private organizationService: OrganizationService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private dialogService: DialogService,
    private formBuilder: FormBuilder,
    private configService: ConfigService,
  ) {}

  async ngOnInit() {
    this.selfHosted = this.platformUtilsService.isSelfHost();

    this.route.params
      .pipe(
        switchMap((params) => this.organizationService.get$(params.organizationId)),
        switchMap((organization) => {
          return combineLatest([
            of(organization),
            // OrganizationResponse for form population
            from(this.organizationApiService.get(organization.id)),
            // Organization Public Key
            from(this.organizationApiService.getKeys(organization.id)),
          ]);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe(([organization, orgResponse, orgKeys]) => {
        // Set domain level organization variables
        this.organizationId = organization.id;
        this.canEditSubscription = organization.canEditSubscription;
        this.canUseApi = organization.useApi;

        // Update disabled states - reactive forms prefers not using disabled attribute
        if (!this.selfHosted) {
          this.formGroup.get("orgName").enable();
          this.formGroup.get("businessName").enable();
          this.collectionManagementFormGroup.get("limitCollectionCreationDeletion").enable();
          this.collectionManagementFormGroup.get("allowAdminAccessToAllCollectionItems").enable();
        }

        if (!this.selfHosted && this.canEditSubscription) {
          this.formGroup.get("billingEmail").enable();
        }

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
        this.collectionManagementFormGroup.patchValue({
          limitCollectionCreationDeletion: this.org.limitCollectionCreationDeletion,
          allowAdminAccessToAllCollectionItems: this.org.allowAdminAccessToAllCollectionItems,
        });

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

    await this.organizationApiService.save(this.organizationId, request);

    this.platformUtilsService.showToast("success", null, this.i18nService.t("organizationUpdated"));
  };

  async showConfirmCollectionEnhancementsDialog() {
    const collectionEnhancementsDialogOptions: SimpleDialogOptions = {
      title: this.i18nService.t("confirmCollectionEnhancementsDialogTitle"),
      content: this.i18nService.t("confirmCollectionEnhancementsDialogContent"),
      type: "warning",
      acceptButtonText: this.i18nService.t("continue"),
      acceptAction: async () => {
        await this.organizationApiService.enableCollectionEnhancements(this.organizationId);

        this.platformUtilsService.showToast(
          "success",
          null,
          this.i18nService.t("updatedCollectionManagement"),
        );
      },
    };

    await this.dialogService.openSimpleDialog(collectionEnhancementsDialogOptions);
  }

  submitCollectionManagement = async () => {
    // Early exit if self-hosted
    if (this.selfHosted) {
      return;
    }

    const request = new OrganizationCollectionManagementUpdateRequest();
    request.limitCreateDeleteOwnerAdmin =
      this.collectionManagementFormGroup.value.limitCollectionCreationDeletion;
    request.allowAdminAccessToAllCollectionItems =
      this.collectionManagementFormGroup.value.allowAdminAccessToAllCollectionItems;

    await this.organizationApiService.updateCollectionManagement(this.organizationId, request);

    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("updatedCollectionManagement"),
    );
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
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
        this.organizationApiService,
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
