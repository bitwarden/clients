import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { RequestItemCardComponent } from "../../request-summary/request-item-card.component";

export type WithdrawApprovalDialogParams = {
  /** The text the caller shows for the item, so the dialog names it as the row does. */
  itemName: string;
  organizationName: string | null;
  collectionName: string | null;
  /** Who loses the approval, named in the warning. */
  requesterName: string;
  /** The decrypted gated cipher, for the favicon; absent when the approver can't see it. */
  cipher?: CipherViewLike;
};

/** Only an explicit confirm produces a result; every other way out closes with `undefined`. */
export type WithdrawApprovalDialogResult = {
  confirmed: true;
  reason: string;
};

/**
 * Confirms withdrawing an approval the requester has not started, and collects the reason the
 * server records on the approver's decision and shows the requester. Returns the reason for the
 * caller to send.
 */
@Component({
  selector: "pam-withdraw-approval-dialog",
  templateUrl: "./withdraw-approval-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    DialogModule,
    FormFieldModule,
    ReactiveFormsModule,
    RequestItemCardComponent,
    I18nPipe,
  ],
})
export class WithdrawApprovalDialogComponent {
  private readonly dialogRef =
    inject<DialogRef<WithdrawApprovalDialogResult | undefined>>(DialogRef);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly params = inject<WithdrawApprovalDialogParams>(DIALOG_DATA);

  /**
   * A group for one control, since `[bitSubmit]` only matches a `[formGroup]` and drives the
   * confirm button's busy state.
   */
  protected readonly formGroup = this.formBuilder.nonNullable.group({
    reason: ["", Validators.required],
  });

  private readonly reason = toSignal(this.formGroup.controls.reason.valueChanges, {
    initialValue: "",
  });

  /** `Validators.required` accepts spaces, so the button also gates on the trimmed value. */
  protected readonly confirmDisabled = computed(() => this.reason().trim().length === 0);

  protected readonly confirm = async (): Promise<void> => {
    if (this.confirmDisabled()) {
      return;
    }
    void this.dialogRef.close({
      confirmed: true,
      reason: this.formGroup.getRawValue().reason.trim(),
    });
  };

  static open(
    dialogService: DialogService,
    config: DialogConfig<WithdrawApprovalDialogParams>,
  ): DialogRef<WithdrawApprovalDialogResult | undefined> {
    return dialogService.open<
      WithdrawApprovalDialogResult | undefined,
      WithdrawApprovalDialogParams
    >(WithdrawApprovalDialogComponent, config);
  }
}
