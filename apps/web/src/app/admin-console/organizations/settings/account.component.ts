// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit, ViewChild, ViewContainerRef } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import {
  combineLatest,
  firstValueFrom,
  from,
  lastValueFrom,
  of,
  Subject,
  switchMap,
  takeUntil,
} from "rxjs";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationCollectionManagementUpdateRequest } from "@bitwarden/common/admin-console/models/request/organization-collection-management-update.request";
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";
import { OrganizationUpdateRequest } from "@bitwarden/common/admin-console/models/request/organization-update.request";
import { OrganizationResponse } from "@bitwarden/common/admin-console/models/response/organization.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { ApiKeyComponent } from "../../../auth/settings/security/api-key.component";
import { PurgeVaultComponent } from "../../../vault/settings/purge-vault.component";

import { DeleteOrganizationDialogResult, openDeleteOrganizationDialog } from "./components";

@Component({
  selector: "app-org-account",
  templateUrl: "account.component.html",
})
export class AccountComponent implements OnInit, OnDestroy {
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

  limitItemDeletionFeatureFlagIsEnabled: boolean;

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
  });

  protected collectionManagementFormGroup = this.formBuilder.group({
    limitCollectionCreation: this.formBuilder.control({ value: false, disabled: false }),
    limitCollectionDeletion: this.formBuilder.control({ value: false, disabled: false }),
    limitItemDeletion: this.formBuilder.control({ value: false, disabled: false }),
    allowAdminAccessToAllCollectionItems: this.formBuilder.control({
      value: false,
      disabled: false,
    }),
  });

  protected organizationId: string;
  protected publicKeyBuffer: Uint8Array;

  private destroy$ = new Subject<void>();

  constructor(
    private i18nService: I18nService,
    private route: ActivatedRoute,
    private platformUtilsService: PlatformUtilsService,
    private keyService: KeyService,
    private router: Router,
    private accountService: AccountService,
    private organizationService: OrganizationService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private dialogService: DialogService,
    private formBuilder: FormBuilder,
    private toastService: ToastService,
    private configService: ConfigService,
  ) {}

  async ngOnInit() {
    this.selfHosted = this.platformUtilsService.isSelfHost();

    this.configService
      .getFeatureFlag$(FeatureFlag.LimitItemDeletion)
      .pipe(takeUntil(this.destroy$))
      .subscribe((isAble) => (this.limitItemDeletionFeatureFlagIsEnabled = isAble));

    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.route.params
      .pipe(
        switchMap((params) =>
          this.organizationService
            .organizations$(userId)
            .pipe(getOrganizationById(params.organizationId)),
        ),
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
          if (this.canEditSubscription) {
            this.formGroup.get("billingEmail").enable();
          }
        }

        // Org Response
        this.org = orgResponse;

        // Public Key Buffer for Org Fingerprint Generation
        this.publicKeyBuffer = Utils.fromB64ToArray(orgKeys?.publicKey);

        // Patch existing values
        this.formGroup.patchValue({
          orgName: this.org.name,
          billingEmail: this.org.billingEmail,
        });

        this.collectionManagementFormGroup.patchValue({
          limitCollectionCreation: this.org.limitCollectionCreation,
          limitCollectionDeletion: this.org.limitCollectionDeletion,
          limitItemDeletion: this.org.limitItemDeletion,
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

    /*
     * When you disable a FormControl, it is removed from formGroup.values, so we have to use
     * the original value.
     * */
    request.name = this.formGroup.get("orgName").disabled
      ? this.org.name
      : this.formGroup.value.orgName;
    request.billingEmail = this.formGroup.get("billingEmail").disabled
      ? this.org.billingEmail
      : this.formGroup.value.billingEmail;

    // Backfill pub/priv key if necessary
    if (!this.org.hasPublicAndPrivateKeys) {
      const orgShareKey = await this.keyService.getOrgKey(this.organizationId);
      const orgKeys = await this.keyService.makeKeyPair(orgShareKey);
      request.keys = new OrganizationKeysRequest(orgKeys[0], orgKeys[1].encryptedString);
    }

    await this.organizationApiService.save(this.organizationId, request);

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("organizationUpdated"),
    });
  };

  submitCollectionManagement = async () => {
    const request = new OrganizationCollectionManagementUpdateRequest();
    request.limitCollectionCreation =
      this.collectionManagementFormGroup.value.limitCollectionCreation;
    request.limitCollectionDeletion =
      this.collectionManagementFormGroup.value.limitCollectionDeletion;
    request.allowAdminAccessToAllCollectionItems =
      this.collectionManagementFormGroup.value.allowAdminAccessToAllCollectionItems;
    request.limitItemDeletion = this.collectionManagementFormGroup.value.limitItemDeletion;

    await this.organizationApiService.updateCollectionManagement(this.organizationId, request);

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("updatedCollectionManagement"),
    });
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

  purgeVault = async () => {
    const dialogRef = PurgeVaultComponent.open(this.dialogService, {
      data: {
        organizationId: this.organizationId,
      },
    });
    await lastValueFrom(dialogRef.closed);
  };

  async viewApiKey() {
    await ApiKeyComponent.open(this.dialogService, {
      data: {
        keyType: "organization",
        entityId: this.organizationId,
        postKey: this.organizationApiService.getOrCreateApiKey.bind(this.organizationApiService),
        scope: "api.organization",
        grantType: "client_credentials",
        apiKeyTitle: "apiKey",
        apiKeyWarning: "apiKeyWarning",
        apiKeyDescription: "apiKeyDesc",
      },
    });
  }

  async rotateApiKey() {
    await ApiKeyComponent.open(this.dialogService, {
      data: {
        keyType: "organization",
        isRotation: true,
        entityId: this.organizationId,
        postKey: this.organizationApiService.rotateApiKey.bind(this.organizationApiService),
        scope: "api.organization",
        grantType: "client_credentials",
        apiKeyTitle: "apiKey",
        apiKeyWarning: "apiKeyWarning",
        apiKeyDescription: "apiKeyRotateDesc",
      },
    });
  }
}
