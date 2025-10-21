// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import {
  DIALOG_DATA,
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  IconButtonModule,
  SearchModule,
  ToastService,
  DialogModule,
} from "@bitwarden/components";

import { SendFormConfig, SendFormMode, SendFormModule } from "../send-form";

export interface SendItemDialogParams {
  /**
   * The configuration object for the dialog and form.
   */
  formConfig: SendFormConfig;

  /**
   * If true, the "edit" button will be disabled in the dialog.
   */
  disableForm?: boolean;
}

/** A result of the Send add/edit dialog. */
export const SendItemDialogResult = Object.freeze({
  /** The send item was created or updated. */
  Saved: "saved",
  /** The send item was deleted. */
  Deleted: "deleted",
} as const);

/** A result of the Send add/edit dialog. */
export type SendItemDialogResult = (typeof SendItemDialogResult)[keyof typeof SendItemDialogResult];

const namesBySendItemDialogResult = new Map<
  SendItemDialogResult,
  keyof typeof SendItemDialogResult
>(
  Object.entries(SendItemDialogResult).map(([k, v]) => [
    v as SendItemDialogResult,
    k as keyof typeof SendItemDialogResult,
  ]),
);

/**
 * Checks if a value is a valid SendItemDialogResult.
 * @param value - The value to check.
 * @returns True if the value is a valid SendItemDialogResult, false otherwise.
 */
export function isSendItemDialogResult(value: unknown): value is SendItemDialogResult {
  return namesBySendItemDialogResult.has(value as SendItemDialogResult);
}

/**
 * Converts a value to a SendItemDialogResult if it is valid.
 * @param value - The value to convert.
 * @returns The value as a SendItemDialogResult if valid, otherwise undefined.
 */
export function asSendItemDialogResult(value: unknown): SendItemDialogResult | undefined {
  return isSendItemDialogResult(value) ? (value as SendItemDialogResult) : undefined;
}

/**
 * Gets the name of a SendItemDialogResult value.
 * @param value - The SendItemDialogResult value to get the name for.
 * @returns The name of the SendItemDialogResult value, or undefined if not found.
 */
export function nameOfSendItemDialogResult(
  value: SendItemDialogResult,
): keyof typeof SendItemDialogResult | undefined {
  return namesBySendItemDialogResult.get(value);
}

/**
 * Component for adding or editing a send item.
 */
@Component({
  templateUrl: "send-add-edit-dialog.component.html",
  imports: [
    CommonModule,
    SearchModule,
    JslibModule,
    FormsModule,
    ButtonModule,
    IconButtonModule,
    SendFormModule,
    AsyncActionsModule,
    DialogModule,
  ],
})
export class SendAddEditDialogComponent {
  /**
   * The header text for the component.
   */
  headerText: string;

  /**
   * The configuration for the send form.
   */
  config: SendFormConfig;

  constructor(
    @Inject(DIALOG_DATA) protected params: SendItemDialogParams,
    private dialogRef: DialogRef<SendItemDialogResult>,
    private i18nService: I18nService,
    private sendApiService: SendApiService,
    private toastService: ToastService,
    private dialogService: DialogService,
  ) {
    this.config = params.formConfig;
    this.headerText = this.getHeaderText(this.config.mode, this.config.sendType);
  }

  /**
   * Handles the event when the send is created.
   */
  async onSendCreated(send: SendView) {
    // FIXME Add dialogService.open send-created dialog
    this.dialogRef.close(SendItemDialogResult.Saved);
    return;
  }

  /**
   * Handles the event when the send is updated.
   */
  async onSendUpdated(send: SendView) {
    this.dialogRef.close(SendItemDialogResult.Saved);
  }

  /**
   * Handles the event when the send is deleted.
   */
  async onSendDeleted() {
    this.dialogRef.close(SendItemDialogResult.Deleted);

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("deletedSend"),
    });
  }

  /**
   * Handles the deletion of the current Send.
   */
  deleteSend = async () => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteSend" },
      content: { key: "deleteSendPermanentConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      await this.sendApiService.delete(this.config.originalSend?.id);
    } catch (e) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: e.message,
      });
      return;
    }

    await this.onSendDeleted();
  };

  /**
   * Gets the header text based on the mode and type.
   * @param mode The mode of the send form.
   * @param type The type of the send
   * @returns The header text.
   */
  private getHeaderText(mode: SendFormMode, type: SendType) {
    const isEditMode = mode === "edit" || mode === "partial-edit";
    const translation = {
      [SendType.Text]: isEditMode ? "editItemHeaderTextSend" : "newItemHeaderTextSend",
      [SendType.File]: isEditMode ? "editItemHeaderFileSend" : "newItemHeaderFileSend",
    };
    return this.i18nService.t(translation[type]);
  }

  /**
   * Opens the send add/edit dialog.
   * @param dialogService Instance of the DialogService.
   * @param params The parameters for the dialog.
   * @returns The dialog result.
   */
  static open(dialogService: DialogService, params: SendItemDialogParams) {
    return dialogService.open<SendItemDialogResult, SendItemDialogParams>(
      SendAddEditDialogComponent,
      {
        data: params,
      },
    );
  }
}
