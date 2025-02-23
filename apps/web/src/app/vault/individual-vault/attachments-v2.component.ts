// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";

import { CipherId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { CipherAttachmentsComponent } from "@bitwarden/vault";

import { SharedModule } from "../../shared/shared.module";

export interface AttachmentsDialogParams {
  cipherId: CipherId;
}

/**
 * Enum representing the possible results of the attachment dialog.
 */
export enum AttachmentDialogResult {
  Uploaded = "uploaded",
  Removed = "removed",
  Closed = "closed",
}

export interface AttachmentDialogCloseResult {
  action: AttachmentDialogResult;
}

/**
 * Component for the attachments dialog.
 */
@Component({
  selector: "app-vault-attachments-v2",
  templateUrl: "attachments-v2.component.html",
  standalone: true,
  imports: [CommonModule, SharedModule, CipherAttachmentsComponent],
})
export class AttachmentsV2Component {
  cipherId: CipherId;
  attachmentFormId = CipherAttachmentsComponent.attachmentFormID;

  /**
   * Constructor for AttachmentsV2Component.
   * @param dialogRef - Reference to the dialog.
   * @param params - Parameters passed to the dialog.
   */
  constructor(
    private dialogRef: DialogRef<AttachmentDialogCloseResult>,
    @Inject(DIALOG_DATA) public params: AttachmentsDialogParams,
  ) {
    this.cipherId = params.cipherId;
  }

  /**
   * Opens the attachments dialog.
   * @param dialogService - The dialog service.
   * @param params - The parameters for the dialog.
   * @returns The dialog reference.
   */
  static open(
    dialogService: DialogService,
    params: AttachmentsDialogParams,
  ): DialogRef<AttachmentDialogCloseResult> {
    return dialogService.open(AttachmentsV2Component, {
      data: params,
    });
  }

  /**
   * Called when an attachment is successfully uploaded.
   * Closes the dialog with an 'uploaded' result.
   */
  uploadSuccessful() {
    this.dialogRef.close({
      action: AttachmentDialogResult.Uploaded,
    });
  }

  /**
   * Called when an attachment is successfully removed.
   * Closes the dialog with a 'removed' result.
   */
  removalSuccessful() {
    this.dialogRef.close({
      action: AttachmentDialogResult.Removed,
    });
  }
}
