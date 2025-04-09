import { DialogRef } from "@angular/cdk/dialog";
import { Component } from "@angular/core";
import {
  AbstractControl,
  AsyncValidatorFn,
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
import {
  BitSubmitDirective,
  ButtonModule,
  DialogModule,
  DialogService,
  FormFieldModule,
} from "@bitwarden/components";

interface RequestSponsorshipForm {
  sponsorshipEmail: FormControl<string>;
  sponsorshipNote: FormControl<string>;
}

export interface AddSponsorshipDialogResult {
  action: AddSponsorshipDialogAction;
  value: Partial<AddSponsorshipFormValue>;
}

interface AddSponsorshipFormValue {
  sponsorshipEmail: string;
  sponsorshipNote: string;
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
    BitSubmitDirective,
  ],
})
export class AddSponsorshipDialogComponent {
  sponsorshipForm: FormGroup<RequestSponsorshipForm>;

  constructor(
    private dialogRef: DialogRef<AddSponsorshipDialogResult>,
    private formBuilder: FormBuilder,
    private accountService: AccountService,
    private i18nService: I18nService,
  ) {
    this.sponsorshipForm = this.formBuilder.group<RequestSponsorshipForm>({
      sponsorshipEmail: new FormControl("", {
        validators: [Validators.email, Validators.required],
        asyncValidators: [
          this.notAllowedValueAsync(
            () => firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.email))),
            true,
          ),
        ],
        updateOn: "change",
      }),
      sponsorshipNote: new FormControl("", {
        validators: [Validators.required],
        updateOn: "change",
      }),
    });
  }

  static open(dialogService: DialogService): DialogRef<AddSponsorshipDialogResult> {
    return dialogService.open<AddSponsorshipDialogResult>(AddSponsorshipDialogComponent);
  }

  protected save = () => {
    this.dialogRef.close({
      action: AddSponsorshipDialogAction.Saved,
      value: this.sponsorshipForm.value,
    });
  };

  protected close = () => {
    this.dialogRef.close({ action: AddSponsorshipDialogAction.Canceled, value: null });
  };

  get sponsorshipEmailControl() {
    return this.sponsorshipForm.controls.sponsorshipEmail;
  }

  get sponsorshipNoteControl() {
    return this.sponsorshipForm.controls.sponsorshipEmail;
  }

  notAllowedValueAsync(
    valueGetter: () => Promise<string>,
    caseInsensitive = false,
  ): AsyncValidatorFn {
    return async (control: AbstractControl): Promise<ValidationErrors | null> => {
      let notAllowedValue = await valueGetter();
      let controlValue = control.value;
      if (caseInsensitive) {
        notAllowedValue = notAllowedValue.toLowerCase();
        controlValue = controlValue.toLowerCase();
      }

      if (controlValue === notAllowedValue) {
        return {
          errors: {
            message: this.i18nService.t("cannotSponsorSelf"),
          },
        };
      }
    };
  }
}
