// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormControl, FormGroup, ValidatorFn, Validators } from "@angular/forms";
import { Subject, takeUntil, Observable, firstValueFrom } from "rxjs";

import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain-api.service.abstraction";
import { OrgDomainServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain.service.abstraction";
import { OrganizationDomainResponse } from "@bitwarden/common/admin-console/abstractions/organization-domain/responses/organization-domain.response";
import { OrganizationDomainRequest } from "@bitwarden/common/admin-console/services/organization-domain/requests/organization-domain.request";
import { HttpStatusCode } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CryptoFunctionService as CryptoFunctionServiceAbstraction } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { domainNameValidator } from "./validators/domain-name.validator";
import { uniqueInArrayValidator } from "./validators/unique-in-array.validator";
export interface DomainAddEditDialogData {
  organizationId: string;
  orgDomain: OrganizationDomainResponse;
  existingDomainNames: Array<string>;
}

@Component({
  templateUrl: "domain-add-edit-dialog.component.html",
})
export class DomainAddEditDialogComponent implements OnInit, OnDestroy {
  private componentDestroyed$: Subject<void> = new Subject();

  accountDeprovisioningEnabled$: Observable<boolean>;
  domainForm: FormGroup;

  get domainNameCtrl(): FormControl {
    return this.domainForm.controls.domainName as FormControl;
  }
  get txtCtrl(): FormControl {
    return this.domainForm.controls.txt as FormControl;
  }

  rejectedDomainNameValidator: ValidatorFn = null;

  rejectedDomainNames: Array<string> = [];

  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) public data: DomainAddEditDialogData,
    private formBuilder: FormBuilder,
    private cryptoFunctionService: CryptoFunctionServiceAbstraction,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private orgDomainApiService: OrgDomainApiServiceAbstraction,
    private orgDomainService: OrgDomainServiceAbstraction,
    private validationService: ValidationService,
    private dialogService: DialogService,
    private toastService: ToastService,
    private configService: ConfigService,
  ) {
    this.accountDeprovisioningEnabled$ = this.configService.getFeatureFlag$(
      FeatureFlag.AccountDeprovisioning,
    );
  }

  // Angular Method Implementations

  async ngOnInit(): Promise<void> {
    this.domainForm = this.formBuilder.group({
      domainName: [
        "",
        [
          Validators.required,
          domainNameValidator(
            (await firstValueFrom(this.accountDeprovisioningEnabled$))
              ? this.i18nService.t("invalidDomainNameClaimMessage")
              : this.i18nService.t("invalidDomainNameMessage"),
          ),
          uniqueInArrayValidator(
            this.data.existingDomainNames,
            this.i18nService.t("duplicateDomainError"),
          ),
        ],
      ],
      txt: [{ value: null, disabled: true }],
    });
    // If we have data.orgDomain, then editing, otherwise creating new domain
    await this.populateForm();
  }

  ngOnDestroy(): void {
    this.componentDestroyed$.next();
    this.componentDestroyed$.complete();
  }

  // End Angular Method Implementations

  // Form methods

  async populateForm(): Promise<void> {
    if (this.data.orgDomain) {
      // Edit
      this.domainForm.patchValue(this.data.orgDomain);
      this.domainForm.disable();
    }

    this.setupFormListeners();
  }

  setupFormListeners(): void {
    // <bit-form-field> suppresses touched state on change for reactive form controls
    // Manually set touched to show validation errors as the user stypes
    this.domainForm.valueChanges.pipe(takeUntil(this.componentDestroyed$)).subscribe(() => {
      this.domainForm.markAllAsTouched();
    });
  }

  copyDnsTxt(): void {
    this.orgDomainService.copyDnsTxt(this.txtCtrl.value);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("valueCopied", this.i18nService.t("dnsTxtRecord")),
    });
  }

  // End Form methods

  // Async Form Actions
  // Creates a new domain record. The DNS TXT Record will be generated server-side and returned in the response.
  saveDomain = async (): Promise<void> => {
    if (this.domainForm.invalid) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("domainFormInvalid"),
      });
      return;
    }

    this.domainNameCtrl.disable();

    const request: OrganizationDomainRequest = new OrganizationDomainRequest(
      this.domainNameCtrl.value,
    );

    try {
      this.data.orgDomain = await this.orgDomainApiService.post(this.data.organizationId, request);
      // Patch the DNS TXT Record that was generated server-side
      this.domainForm.controls.txt.patchValue(this.data.orgDomain.txt);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("domainSaved"),
      });
    } catch (e) {
      this.handleDomainSaveError(e);
    }
  };

  private handleDomainSaveError(e: any): void {
    if (e instanceof ErrorResponse) {
      const errorResponse: ErrorResponse = e as ErrorResponse;
      switch (errorResponse.statusCode) {
        case HttpStatusCode.Conflict:
          if (errorResponse.message.includes("The domain is not available to be claimed")) {
            // If user has attempted to claim a different rejected domain first:
            if (this.rejectedDomainNameValidator) {
              // Remove the validator:
              this.domainNameCtrl.removeValidators(this.rejectedDomainNameValidator);
              this.domainNameCtrl.updateValueAndValidity();
            }

            // Update rejected domain names and add new unique in validator
            // which will prevent future known bad domain name submissions.
            this.rejectedDomainNames.push(this.domainNameCtrl.value);

            this.rejectedDomainNameValidator = uniqueInArrayValidator(
              this.rejectedDomainNames,
              this.i18nService.t("domainNotAvailable", this.domainNameCtrl.value),
            );

            this.domainNameCtrl.addValidators(this.rejectedDomainNameValidator);
            this.domainNameCtrl.updateValueAndValidity();

            // Give them another chance to enter a new domain name:
            this.domainForm.enable();
          } else {
            this.validationService.showError(errorResponse);
          }

          break;

        default:
          this.validationService.showError(errorResponse);
          break;
      }
    } else {
      this.validationService.showError(e);
    }
  }

  verifyDomain = async (): Promise<void> => {
    if (this.domainForm.invalid) {
      // Note: shouldn't be possible, but going to leave this to be safe.
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("domainFormInvalid"),
      });
      return;
    }

    try {
      this.data.orgDomain = await this.orgDomainApiService.verify(
        this.data.organizationId,
        this.data.orgDomain.id,
      );

      if (this.data.orgDomain.verifiedDate) {
        this.toastService.showToast({
          variant: "success",
          title: null,
          message: this.i18nService.t(
            (await firstValueFrom(this.accountDeprovisioningEnabled$))
              ? "domainClaimed"
              : "domainVerified",
          ),
        });
        this.dialogRef.close();
      } else {
        this.domainNameCtrl.setErrors({
          errorPassthrough: {
            message: this.i18nService.t(
              (await firstValueFrom(this.accountDeprovisioningEnabled$))
                ? "domainNotClaimed"
                : "domainNotVerified",
              this.domainNameCtrl.value,
            ),
          },
        });
        // For the case where user opens dialog and reverifies when domain name formControl disabled.
        // The input directive only shows error if touched, so must manually mark as touched.
        this.domainNameCtrl.markAsTouched();
        // Update this item so the last checked date gets updated.
        await this.updateOrgDomain();
      }
    } catch (e) {
      this.handleVerifyDomainError(e, this.domainNameCtrl.value);
      // Update this item so the last checked date gets updated.
      await this.updateOrgDomain();
    }
  };

  private handleVerifyDomainError(e: any, domainName: string): void {
    if (e instanceof ErrorResponse) {
      const errorResponse: ErrorResponse = e as ErrorResponse;
      switch (errorResponse.statusCode) {
        case HttpStatusCode.Conflict:
          if (errorResponse.message.includes("The domain is not available to be claimed")) {
            this.domainNameCtrl.setErrors({
              errorPassthrough: {
                message: this.i18nService.t("domainNotAvailable", domainName),
              },
            });
          }
          break;

        default:
          this.validationService.showError(errorResponse);
          break;
      }
    }
  }

  private async updateOrgDomain() {
    // Update this item so the last checked date gets updated.
    await this.orgDomainApiService.getByOrgIdAndOrgDomainId(
      this.data.organizationId,
      this.data.orgDomain.id,
    );
  }

  deleteDomain = async (): Promise<void> => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "removeDomain" },
      content: { key: "removeDomainWarning" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    await this.orgDomainApiService.delete(this.data.organizationId, this.data.orgDomain.id);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("domainRemoved"),
    });

    this.dialogRef.close();
  };

  // End Async Form Actions
}
