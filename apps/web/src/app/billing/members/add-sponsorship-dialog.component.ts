import { DialogRef } from "@angular/cdk/dialog";
import { Component } from "@angular/core";
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
import { firstValueFrom, map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
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

  constructor(
    private dialogRef: DialogRef<AddSponsorshipDialogResult>,
    private formBuilder: FormBuilder,
    private accountService: AccountService,
    private i18nService: I18nService,
  ) {
    this.sponsorshipForm = this.formBuilder.group<RequestSponsorshipForm>({
      sponsorshipEmail: new FormControl<string | null>("", {
        validators: [Validators.email, Validators.required],
        asyncValidators: [this.validateNotCurrentUserEmail.bind(this)],
        updateOn: "change",
      }),
      sponsorshipNote: new FormControl<string | null>("", {}),
    });
  }

  static open(dialogService: DialogService): DialogRef<AddSponsorshipDialogResult> {
    return dialogService.open<AddSponsorshipDialogResult>(AddSponsorshipDialogComponent);
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

  private async validateNotCurrentUserEmail(
    control: AbstractControl,
  ): Promise<ValidationErrors | null> {
    const value = control.value;
    if (!value) {
      return null;
    }

    const currentUserEmail = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.email ?? "")),
    );

    if (!currentUserEmail) {
      return null;
    }

    if (value.toLowerCase() === currentUserEmail.toLowerCase()) {
      return { currentUserEmail: true };
    }

    return null;
  }
}
