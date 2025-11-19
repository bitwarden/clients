// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";

import { CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import {
  ButtonModule,
  DialogModule,
  DialogService,
  DIALOG_DATA,
  DialogRef,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { CipherAttachmentsComponent } from "../../cipher-form/components/attachments/cipher-attachments.component";

export interface AttachmentsDialogParams {
  cipherId: CipherId;
  admin?: boolean;
  organizationId?: OrganizationId;
}

/**
 * Enum representing the possible results of the attachment dialog.
 */
export const AttachmentDialogResult = {
  Uploaded: "uploaded",
  Removed: "removed",
  Closed: "closed",
} as const;

export type AttachmentDialogResult = UnionOfValues<typeof AttachmentDialogResult>;

export interface AttachmentDialogCloseResult {
  action: AttachmentDialogResult;
}

/**
 * Component for the attachments dialog.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-vault-attachments-v2",
  templateUrl: "attachments-v2.component.html",
  imports: [ButtonModule, CommonModule, DialogModule, I18nPipe, CipherAttachmentsComponent],
})
export class AttachmentsV2Component {
  cipherId: CipherId;
  admin: boolean = false;
  organizationId?: OrganizationId;
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
    this.organizationId = params.organizationId;
    this.admin = params.admin ?? false;
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
