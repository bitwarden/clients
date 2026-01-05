import { Component, Inject } from "@angular/core";
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from "@angular/forms";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PlanSponsorshipType } from "@bitwarden/common/billing/enums";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrgKey } from "@bitwarden/common/types/key";
import {
  DialogRef,
  ButtonModule,
  DialogConfig,
  DIALOG_DATA,
  DialogModule,
  DialogService,
  FormFieldModule,
  ToastService,
} from "@bitwarden/components";

interface RequestSponsorshipForm {
  sponsorshipEmail: FormControl<string | null>;
  sponsorshipNote: FormControl<string | null>;
}

interface AddSponsorshipDialogParams {
  organizationId: string;
  organizationKey: OrgKey;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "add-sponsorship-dialog.component.html",
  imports: [
    JslibModule,
    ButtonModule,
    DialogModule,
    FormsModule,
    ReactiveFormsModule,
    FormFieldModule,
  ],
})
export class AddSponsorshipDialogComponent {
  sponsorshipForm: FormGroup<RequestSponsorshipForm>;
  loading = false;
  organizationId: string;
  organizationKey: OrgKey;

  constructor(
    private dialogRef: DialogRef,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private organizationUserApiService: OrganizationUserApiService,
    private toastService: ToastService,
    private apiService: ApiService,
    private encryptService: EncryptService,

    @Inject(DIALOG_DATA) protected dialogParams: AddSponsorshipDialogParams,
  ) {
    this.organizationId = this.dialogParams?.organizationId;
    this.organizationKey = this.dialogParams.organizationKey;

    this.sponsorshipForm = this.formBuilder.group<RequestSponsorshipForm>({
      sponsorshipEmail: new FormControl<string | null>("", {
        validators: [Validators.email, Validators.required],
        asyncValidators: [this.isOrganizationMember.bind(this)],
        updateOn: "change",
      }),
      sponsorshipNote: new FormControl<string | null>("", {
        validators: [Validators.maxLength(1000)],
      }),
    });
  }

  static open(dialogService: DialogService, config: DialogConfig<AddSponsorshipDialogParams>) {
    return dialogService.open(AddSponsorshipDialogComponent, {
      ...config,
      data: config.data,
    } as unknown as DialogConfig<unknown, DialogRef>);
  }

  protected async save() {
    this.sponsorshipEmailControl.markAllAsTouched();

    if (this.sponsorshipForm.invalid) {
      return;
    }
    this.loading = true;

    try {
      const notes = this.sponsorshipForm.value.sponsorshipNote || "";
      const email = this.sponsorshipForm.value.sponsorshipEmail || "";

      const encryptedNotes = await this.encryptService.encryptString(notes, this.organizationKey);
      const isAdminInitiated = true;
      await this.apiService.postCreateSponsorship(this.organizationId, {
        sponsoredEmail: email,
        planSponsorshipType: PlanSponsorshipType.FamiliesForEnterprise,
        friendlyName: email,
        isAdminInitiated,
        notes: encryptedNotes.encryptedString,
      });

      this.toastService.showToast({
        variant: "success",
        title: undefined,
        message: this.i18nService.t("sponsorshipCreated"),
      });
      await this.resetForm();
    } catch (e: any) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: e?.message || this.i18nService.t("unexpectedError"),
      });
    }

    this.loading = false;

    this.dialogRef.close();
  }

  private async resetForm() {
    this.sponsorshipForm.reset();
  }

  get sponsorshipEmailControl() {
    return this.sponsorshipForm.controls.sponsorshipEmail;
  }

  get sponsorshipNoteControl() {
    return this.sponsorshipForm.controls.sponsorshipNote;
  }

  private async isOrganizationMember(control: AbstractControl): Promise<ValidationErrors | null> {
    const value = control.value;

    const users = await this.organizationUserApiService.getAllMiniUserDetails(this.organizationId);

    const userExists = users.data.some(
      (member) => member.email.toLowerCase() === value.toLowerCase(),
    );

    if (userExists) {
      return {
        isOrganizationMember: {
          message: this.i18nService.t("organizationHasMemberMessage", value),
        },
      };
    }

    return null;
  }
}
