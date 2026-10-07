import { Component, DestroyRef, inject, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from "@angular/forms";

import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain-api.service.abstraction";
import { OrgDomainServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain.service.abstraction";
import { OrganizationDomainResponse } from "@bitwarden/common/admin-console/abstractions/organization-domain/responses/organization-domain.response";
import { OrganizationDomainRequest } from "@bitwarden/common/admin-console/services/organization-domain/requests/organization-domain.request";
import { HttpStatusCode } from "@bitwarden/common/enums";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  AutofocusDirective,
  BadgeModule,
  ButtonModule,
  DialogModule,
  DialogRef,
  DIALOG_DATA,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  LinkModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { domainNameValidator } from "./validators/domain-name.validator";
import { uniqueInArrayValidator } from "./validators/unique-in-array.validator";
export interface DomainAddEditDialogData {
  organizationId: OrganizationId;
  orgDomain?: OrganizationDomainResponse;
  existingDomainNames: string[];
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "domain-add-edit-dialog.component.html",
  imports: [
    ReactiveFormsModule,
    DialogModule,
    TypographyModule,
    BadgeModule,
    FormFieldModule,
    AutofocusDirective,
    ButtonModule,
    AsyncActionsModule,
    IconButtonModule,
    LinkModule,
    I18nPipe,
  ],
})
export class DomainAddEditDialogComponent implements OnInit {
  readonly domainForm = signal<FormGroup | undefined>(undefined);
  protected readonly domainNameReadonly = signal(false);

  get domainNameCtrl(): FormControl {
    return this.domainForm()?.controls.domainName as FormControl;
  }
  get txtCtrl(): FormControl {
    return this.domainForm()?.controls.txt as FormControl;
  }

  readonly rejectedDomainNameValidator = signal<ValidatorFn | undefined>(undefined);

  readonly rejectedDomainNames = signal<string[]>([]);

  dialogRef = inject(DialogRef);
  data = inject<DomainAddEditDialogData>(DIALOG_DATA);

  private formBuilder = inject(FormBuilder);
  private i18nService = inject(I18nService);
  private orgDomainApiService = inject(OrgDomainApiServiceAbstraction);
  private orgDomainService = inject(OrgDomainServiceAbstraction);
  private validationService = inject(ValidationService);
  private dialogService = inject(DialogService);
  private toastService = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  async ngOnInit(): Promise<void> {
    const domainNameValidators = [
      Validators.required,
      domainNameValidator(this.i18nService.t("invalidDomainNameClaimMessage")),
    ];

    // Only check uniqueness when creating — when editing, the domain name is readonly
    // and is already present in existingDomainNames, so the validator would always fail.
    if (!this.data.orgDomain) {
      domainNameValidators.push(
        uniqueInArrayValidator(
          this.data.existingDomainNames,
          this.i18nService.t("duplicateDomainError"),
        ),
      );
    }

    this.domainForm.set(
      this.formBuilder.group({
        domainName: ["", domainNameValidators],
        txt: [null],
      }),
    );
    // If we have data.orgDomain, then editing, otherwise creating new domain
    await this.populateForm();
  }

  async populateForm(): Promise<void> {
    if (this.data.orgDomain) {
      // Edit
      this.domainForm()?.patchValue(this.data.orgDomain);
      this.domainNameReadonly.set(true);
    }

    this.setupFormListeners();
  }

  setupFormListeners(): void {
    // <bit-form-field> suppresses touched state on change for reactive form controls
    // Manually set touched to show validation errors as the user stypes
    this.domainForm()
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.domainForm()?.markAllAsTouched();
      });
  }

  copyDnsTxt(): void {
    this.orgDomainService.copyDnsTxt(this.txtCtrl.value);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("valueCopied", this.i18nService.t("dnsTxtRecord")),
    });
  }

  // Creates a new domain record. The DNS TXT Record will be generated server-side and returned in the response.
  saveDomain = async (): Promise<void> => {
    const domainForm = this.domainForm();
    if (domainForm == null || domainForm.invalid) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("domainFormInvalid"),
      });
      return;
    }

    this.domainNameReadonly.set(true);

    const request: OrganizationDomainRequest = new OrganizationDomainRequest(
      this.domainNameCtrl.value,
    );

    try {
      this.data.orgDomain = await this.orgDomainApiService.post(this.data.organizationId, request);
      // Patch the DNS TXT Record that was generated server-side
      domainForm.controls.txt.patchValue(this.data.orgDomain.txt);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("domainSaved"),
      });
    } catch (e) {
      this.handleDomainSaveError(e);
    }
  };

  private handleDomainSaveError(e: unknown): void {
    if (e instanceof ErrorResponse) {
      const errorResponse: ErrorResponse = e as ErrorResponse;
      switch (errorResponse.statusCode) {
        case HttpStatusCode.Conflict:
          if (errorResponse.message.includes("The domain is not available to be claimed")) {
            // If user has attempted to claim a different rejected domain first:
            const rejectedDomainNameValidator = this.rejectedDomainNameValidator();
            if (rejectedDomainNameValidator) {
              // Remove the validator:
              this.domainNameCtrl.removeValidators(rejectedDomainNameValidator);
              this.domainNameCtrl.updateValueAndValidity();
            }

            // Update rejected domain names and add new unique in validator
            // which will prevent future known bad domain name submissions.
            const rejectedDomainNames = [...this.rejectedDomainNames(), this.domainNameCtrl.value];
            this.rejectedDomainNames.set(rejectedDomainNames);

            const newRejectedDomainNameValidator = uniqueInArrayValidator(
              rejectedDomainNames,
              this.i18nService.t("domainNotAvailable", this.domainNameCtrl.value),
            );
            this.rejectedDomainNameValidator.set(newRejectedDomainNameValidator);

            this.domainNameCtrl.addValidators(newRejectedDomainNameValidator);
            this.domainNameCtrl.updateValueAndValidity();

            // Give them another chance to enter a new domain name:
            this.domainNameReadonly.set(false);
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
    const domainForm = this.domainForm();
    if (domainForm == null || domainForm.invalid || this.data.orgDomain == null) {
      // Note: shouldn't be possible, but going to leave this to be safe.
      this.toastService.showToast({
        variant: "error",
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
          message: this.i18nService.t("domainClaimed"),
        });
        await this.dialogRef.close();
      } else {
        this.domainNameCtrl.setErrors({
          errorPassthrough: {
            message: this.i18nService.t("domainNotClaimed", this.domainNameCtrl.value),
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

  private handleVerifyDomainError(e: unknown, domainName: string): void {
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
    if (this.data.orgDomain == null) {
      return;
    }
    // Update this item so the last checked date gets updated.
    await this.orgDomainApiService.getByOrgIdAndOrgDomainId(
      this.data.organizationId,
      this.data.orgDomain.id,
    );
  }

  deleteDomain = async (): Promise<void> => {
    if (this.data.orgDomain == null) {
      return;
    }

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
      message: this.i18nService.t("domainRemoved"),
    });

    await this.dialogRef.close();
  };
}
