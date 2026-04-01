import { DialogRef } from "@angular/cdk/dialog";
import { Component } from "@angular/core";

import { ChangePasswordComponent } from "@bitwarden/angular/auth/password-management/change-password";
import { InputPasswordFlow } from "@bitwarden/auth/angular";
import { ButtonModule, DialogModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Temporary dialog wrapper for change password until desktop UI refresh adds proper settings routes.
 * TODO: Remove this dialog once desktop has a dedicated settings section in the new UI
 */
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-change-password-dialog",
  templateUrl: "change-password-dialog.component.html",
  imports: [DialogModule, ButtonModule, I18nPipe, ChangePasswordComponent],
})
export class ChangePasswordDialogComponent {
  // We cannot use ChangePasswordWithOptionalUserKeyRotation as the UserKeyRotation service + several service deps it has
  // are only available in the web currently. We would need to migrate those services to common to be able to use the flow here.
  protected inputPasswordFlow = InputPasswordFlow.ChangePassword;

  constructor(private dialogRef: DialogRef) {}

  close() {
    this.dialogRef.close();
  }
}
