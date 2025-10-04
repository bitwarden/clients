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
    rememberPassphrase: [false],
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
    this.dialogRef.close({
      password: this.formGroup.value.sshKeyPassword,
      rememberPassphrase: this.formGroup.value.rememberPassphrase ?? false,
    });
  };
}
