// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Inject, Component } from "@angular/core";

import { CipherId } from "@bitwarden/common/types/guid";
import { PasswordHistoryView } from "@bitwarden/common/vault/models/view/password-history.view";
import { AsyncActionsModule, DialogModule, DialogService } from "@bitwarden/components";
import { PasswordHistoryViewComponent } from "@bitwarden/vault";

import { SharedModule } from "../../shared/shared.module";

/**
 * The parameters for the password history dialog.
 */
export interface ViewPasswordHistoryDialogParams {
  cipherId: CipherId;
}

/**
 * A dialog component that displays the password history for a cipher.
 */
@Component({
  selector: "app-vault-password-history",
  templateUrl: "password-history.component.html",
  standalone: true,
  imports: [
    CommonModule,
    AsyncActionsModule,
    DialogModule,
    SharedModule,
    PasswordHistoryViewComponent,
  ],
})
export class PasswordHistoryComponent {
  /**
   * The ID of the cipher to display the password history for.
   */
  cipherId: CipherId;

  /**
   * The password history for the cipher.
   */
  history: PasswordHistoryView[] = [];

  /**
   * The constructor for the password history dialog component.
   * @param params The parameters passed to the password history dialog.
   * @param dialogRef The dialog reference - used to close the dialog.
   **/
  constructor(
    @Inject(DIALOG_DATA) public params: ViewPasswordHistoryDialogParams,
    private dialogRef: DialogRef<PasswordHistoryComponent>,
  ) {
    /**
     * Set the cipher ID from the parameters.
     */
    this.cipherId = params.cipherId;
  }

  /**
   * Closes the password history dialog.
   */
  close() {
    this.dialogRef.close();
  }
}

/**
 * Strongly typed wrapper around the dialog service to open the password history dialog.
 */
export function openPasswordHistoryDialog(
  dialogService: DialogService,
  config: DialogConfig<ViewPasswordHistoryDialogParams>,
) {
  return dialogService.open(PasswordHistoryComponent, config);
}
