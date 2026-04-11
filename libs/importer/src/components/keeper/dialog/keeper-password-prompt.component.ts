import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  TypographyModule,
} from "@bitwarden/components";

@Component({
  templateUrl: "keeper-password-prompt.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JslibModule,
    ReactiveFormsModule,
    DialogModule,
    FormFieldModule,
    AsyncActionsModule,
    ButtonModule,
    IconButtonModule,
    TypographyModule,
  ],
})
export class KeeperPasswordPromptComponent {
  private readonly dialogRef = inject(DialogRef);

  protected readonly formGroup = new FormGroup({
    password: new FormControl("", {
      validators: Validators.required,
      updateOn: "submit",
    }),
  });

  protected readonly submit = () => {
    this.formGroup.markAsTouched();
    if (!this.formGroup.valid) {
      return;
    }
    this.dialogRef.close(this.formGroup.controls.password.value);
  };

  static open(dialogService: DialogService) {
    const dialogRef = dialogService.open<string>(KeeperPasswordPromptComponent);
    return firstValueFrom(dialogRef.closed);
  }
}
