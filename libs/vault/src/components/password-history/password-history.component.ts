// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Inject, Component } from "@angular/core";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  DialogService,
  DIALOG_DATA,
  DialogRef,
  DialogConfig,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { PasswordHistoryViewComponent } from "@bitwarden/vault";

/**
 * The parameters for the password history dialog.
 */
export interface ViewPasswordHistoryDialogParams {
  cipher: CipherView;
}

/**
 * A dialog component that displays the password history for a cipher.
 */
@Component({
  selector: "app-vault-password-history",
  templateUrl: "password-history.component.html",
  imports: [
    ButtonModule,
    CommonModule,
    AsyncActionsModule,
    I18nPipe,
    DialogModule,
    PasswordHistoryViewComponent,
  ],
})
export class PasswordHistoryComponent {
  /**
   * The cipher to display the password history for.
   */
  cipher: CipherView;

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
     * Set the cipher from the parameters.
     */
    this.cipher = params.cipher;
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
