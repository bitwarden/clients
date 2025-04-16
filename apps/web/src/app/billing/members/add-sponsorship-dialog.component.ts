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
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ButtonModule, DialogModule, DialogService, FormFieldModule } from "@bitwarden/components";

interface RequestSponsorshipForm {
  sponsorshipEmail: FormControl<string | null>;
  sponsorshipNote: FormControl<string | null>;
}

export interface AddSponsorshipDialogResult {
  action: AddSponsorshipDialogAction;
  value: Partial<AddSponsorshipFormValue> | null;
}

interface AddSponsorshipFormValue {
  sponsorshipEmail: string;
  sponsorshipNote: string;
  status: string;
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

  constructor(
    private dialogRef: DialogRef<AddSponsorshipDialogResult>,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private organizationUserApiService: OrganizationUserApiService,
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
    // TODO: This is a mockup implementation - needs to be updated with actual API integration
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call

    const formValue = this.sponsorshipForm.getRawValue();
    const dialogValue: Partial<AddSponsorshipFormValue> = {
      status: "Sent",
      sponsorshipEmail: formValue.sponsorshipEmail ?? "",
      sponsorshipNote: formValue.sponsorshipNote ?? "",
    };

    this.dialogRef.close({
      action: AddSponsorshipDialogAction.Saved,
      value: dialogValue,
    });

    this.loading = false;
  }

  protected close = () => {
    this.dialogRef.close({ action: AddSponsorshipDialogAction.Canceled, value: null });
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
