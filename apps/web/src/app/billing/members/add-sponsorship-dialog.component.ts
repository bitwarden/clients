import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
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
import {
  ButtonModule,
  DialogModule,
  DialogService,
  FormFieldModule,
  ToastService,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

interface RequestSponsorshipForm {
  sponsorshipEmail: FormControl<string | null>;
  sponsorshipNote: FormControl<string | null>;
}

export interface AddSponsorshipDialogResult {
  action: AddSponsorshipDialogAction;
}

enum AddSponsorshipDialogAction {
  Saved = "saved",
  Canceled = "canceled",
}

interface AddSponsorshipDialogParams {
  organizationId: string;
}

@Component({
  templateUrl: "add-sponsorship-dialog.component.html",
  standalone: true,
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
  formPromise: Promise<void>;

  constructor(
    private dialogRef: DialogRef<AddSponsorshipDialogResult>,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private organizationUserApiService: OrganizationUserApiService,
    private toastService: ToastService,
    private apiService: ApiService,
    private encryptService: EncryptService,
    private keyService: KeyService,
    @Inject(DIALOG_DATA) protected dialogParams: AddSponsorshipDialogParams,
  ) {
    this.organizationId = this.dialogParams?.organizationId;

    this.sponsorshipForm = this.formBuilder.group<RequestSponsorshipForm>({
      sponsorshipEmail: new FormControl<string | null>("", {
        validators: [Validators.email, Validators.required],
        asyncValidators: [this.isOrganizationMember.bind(this)],
        updateOn: "change",
      }),
      sponsorshipNote: new FormControl<string | null>("", {}),
    });
  }

  static open(dialogService: DialogService, config: DialogConfig<AddSponsorshipDialogParams>) {
    return dialogService.open<AddSponsorshipDialogResult>(AddSponsorshipDialogComponent, config);
  }

  protected async save() {
    if (this.sponsorshipForm.invalid) {
      return;
    }
    this.loading = true;

    try {
      const orgKey = await this.keyService.getOrgKey(this.organizationId);
      const encryptedNotes = await this.encryptService.encrypt(
        this.sponsorshipForm.value.sponsorshipNote,
        orgKey,
      );
      this.formPromise = this.apiService.postCreateSponsorship(this.organizationId, {
        sponsoredEmail: this.sponsorshipForm.value.sponsorshipEmail,
        planSponsorshipType: PlanSponsorshipType.FamiliesForEnterprise,
        friendlyName: this.sponsorshipForm.value.sponsorshipEmail,
        notes: encryptedNotes.encryptedString,
      });

      await this.formPromise;

      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("sponsorshipCreated"),
      });
      this.formPromise = null;
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.resetForm();
    } catch (e) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: e?.message,
      });
    }

    this.loading = false;

    this.dialogRef.close({
      action: AddSponsorshipDialogAction.Saved,
    });
  }

  private async resetForm() {
    this.sponsorshipForm.reset();
  }

  protected close = () => {
    this.dialogRef.close({ action: AddSponsorshipDialogAction.Canceled });
  };

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
          message: this.i18nService.t("organizationHasMember", value),
        },
      };
    }

    return null;
  }
}
