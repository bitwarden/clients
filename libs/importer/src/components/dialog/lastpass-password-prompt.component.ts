import { DialogRef } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  TypographyModule,
} from "@bitwarden/components";

@Component({
  templateUrl: "lastpass-password-prompt.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    DialogModule,
    FormFieldModule,
    AsyncActionsModule,
    ButtonModule,
    IconButtonModule,
    TypographyModule,
  ],
})
export class LastPassPasswordPromptComponent {
  formGroup = new FormGroup({
    password: new FormControl("", {
      validators: Validators.required,
      updateOn: "submit",
    }),
  });

  constructor(public dialogRef: DialogRef) {}

  submit = () => {
    this.formGroup.markAsTouched();
    if (!this.formGroup.valid) {
      return;
    }
    this.dialogRef.close(this.formGroup.controls.password.value);
  };

  static open(dialogService: DialogService) {
    const dialogRef = dialogService.open<string>(LastPassPasswordPromptComponent);
    return firstValueFrom(dialogRef.closed);
  }
}
