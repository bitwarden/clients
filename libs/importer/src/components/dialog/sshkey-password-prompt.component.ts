import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  FormFieldModule,
  IconButtonModule,
} from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "sshkey-password-prompt.component.html",
  imports: [
    CommonModule,
    JslibModule,
    DialogModule,
    FormFieldModule,
    AsyncActionsModule,
    ButtonModule,
    IconButtonModule,
    ReactiveFormsModule,
  ],
})
export class SshKeyPasswordPromptComponent {
  protected formGroup = this.formBuilder.group({
    sshKeyPassword: ["", Validators.required],
  });

  constructor(
    public dialogRef: DialogRef,
    protected formBuilder: FormBuilder,
  ) {}

  submit = () => {
    this.formGroup.markAsTouched();
    if (!this.formGroup.valid) {
      return;
    }
    this.dialogRef.close(this.formGroup.value.sshKeyPassword);
  };
}
