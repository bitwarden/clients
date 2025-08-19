import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  IconButtonModule,
} from "@bitwarden/components";

/**
 * This is a generic prompt to run encryption migrations that require the master password.
 */
@Component({
  templateUrl: "prompt-migration-password.component.html",
  imports: [
    DialogModule,
    CommonModule,
    JslibModule,
    ButtonModule,
    IconButtonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    FormFieldModule,
  ],
})
export class PromptMigrationPasswordComponent {
  private dialogRef = inject(DialogRef<string>);
  private formBuilder = inject(FormBuilder);

  migrationPasswordForm = this.formBuilder.group({
    masterPassword: ["", [Validators.required]],
  });

  static open(dialogService: DialogService) {
    return dialogService.open<string>(PromptMigrationPasswordComponent);
  }

  submit = async () => {
    const masterPasswordControl = this.migrationPasswordForm.controls.masterPassword;

    if (!masterPasswordControl.value || masterPasswordControl.invalid) {
      return;
    }

    // Return the master password to the caller
    this.dialogRef.close(masterPasswordControl.value);
  };
}
