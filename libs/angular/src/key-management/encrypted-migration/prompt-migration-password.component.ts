import { CommonModule } from "@angular/common";
import { Component, inject, ChangeDetectionStrategy } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { filter, firstValueFrom, map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordUnlockService } from "@bitwarden/common/key-management/master-password/abstractions/master-password-unlock.service";
import {
  LinkModule,
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "prompt-migration-password.component.html",
  imports: [
    DialogModule,
    LinkModule,
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
  private masterPasswordUnlockService = inject(MasterPasswordUnlockService);
  private accountService = inject(AccountService);

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

    const { userId } = await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        filter((account) => account != null),
        map((account) => {
          return {
            userId: account!.id,
          };
        }),
      ),
    );

    if (
      !(await this.masterPasswordUnlockService.proofOfDecryption(
        masterPasswordControl.value,
        userId,
      ))
    ) {
      return;
    }

    // Return the master password to the caller
    this.dialogRef.close(masterPasswordControl.value);
  };
}
