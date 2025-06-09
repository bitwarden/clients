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
  templateUrl: "file-password-prompt.component.html",
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
export class FilePasswordPromptComponent {
  protected formGroup = this.formBuilder.group({
    filePassword: ["", Validators.required],
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
    this.dialogRef.close(this.formGroup.value.filePassword);
  };
}
