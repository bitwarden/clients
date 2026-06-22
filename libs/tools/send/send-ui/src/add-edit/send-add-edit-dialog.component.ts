// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, computed, Inject, signal, viewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { WhoCanAccessType } from "@bitwarden/common/tools/models/send-who-can-access-type";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
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
  ButtonComponent,
  CalloutComponent,
} from "@bitwarden/components";
import { AlgorithmInfo } from "@bitwarden/generator-core";
import { I18nPipe } from "@bitwarden/ui-common";
import { CipherFormGeneratorComponent } from "@bitwarden/vault";

import { SendFormComponent, SendFormConfig, SendFormModule, SendFormService } from "../send-form";
import { SendPolicyService } from "../services/send-policy.service";

export interface SendItemDialogParams {
  /**
   * The configuration object for the dialog and form.
   */
  formConfig: SendFormConfig;

  /**
   * If true, the "edit" button will be disabled in the dialog.
   */
  disableForm?: boolean;

  /**
   * A function that is called to determine whether the dialog is allowed
   * to close. Used to trigger the "unsaved edits" dialog.
   */
  closePredicate?: () => Promise<boolean>;
}

/** A result of the Send add/edit dialog. */
export const SendItemDialogResult = Object.freeze({
  /** The Send item was created*/
  Created: "created",
  /** The Send item was updated */
  Updated: "updated",
  /** The Send item was deleted. */
  Deleted: "deleted",
} as const);

/** A result of the Send add/edit dialog. */
export type SendItemDialogResult = {
  result: (typeof SendItemDialogResult)[keyof typeof SendItemDialogResult];
  send?: SendView;
};
/**
 * Component for adding or editing a send item.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "send-add-edit-dialog.component.html",
  imports: [
    CommonModule,
    SearchModule,
    I18nPipe,
    FormsModule,
    ButtonModule,
    IconButtonModule,
    SendFormModule,
    AsyncActionsModule,
    DialogModule,
    CipherFormGeneratorComponent,
    CalloutComponent,
  ],
})
export class SendAddEditDialogComponent {
  readonly sendFormComponent = viewChild(SendFormComponent);
  readonly submitBtn = viewChild<ButtonComponent>("submitBtn");
  /**
   * The header text translation key for the component.
   */
  readonly headerText = computed(() => {
    if (this.showGenerator()) {
      return "passwordGenerator";
    }
    let sendAction: "view" | "edit" | "add" = "add";
    if (!this.editing()) {
      sendAction = "view";
    } else if (this.config.mode === "edit" || this.config.mode === "partial-edit") {
      sendAction = "edit";
    }
    const translation = {
      [SendType.Text]: {
        view: "viewTextSendHeader",
        edit: "editItemHeaderTextSendV2",
        add: "newItemHeaderTextSendV2",
      },
      [SendType.File]: {
        view: "viewFileSendHeader",
        edit: "editItemHeaderFileSendV2",
        add: "newItemHeaderFileSendV2",
      },
    };
    return translation[this.config.sendType][sendAction];
  });

  /** The configuration for the Send form. */
  config: SendFormConfig;

  /**
   * Whether the form is disabled (e.g., the Send is disabled by policy).
   * When true, the Save button is hidden.
   */
  disableForm = false;

  /**
   * Whether the Send is actively being edited
   */
  protected readonly editing = signal(false);

  /**
   * Whether the inline password generator is currently shown.
   */
  readonly showGenerator = signal(false);

  /**
   * The currently generated password value.
   */
  readonly generatedValue = signal("");

  /**
   * The label for the "Use this password" button.
   */
  readonly generatorButtonLabel = signal<string | undefined>(undefined);

  /**
   * Whether to show the "Make a copy" button or not
   */
  protected readonly showCopyButton = signal(false);

  /**
   * Whether to show the trash icon button on the far right of the footer
   */
  protected readonly showTrashIconButton = signal(false);

  constructor(
    @Inject(DIALOG_DATA) protected params: SendItemDialogParams,
    private dialogRef: DialogRef<SendItemDialogResult>,
    private i18nService: I18nService,
    private sendApiService: SendApiService,
    private toastService: ToastService,
    private dialogService: DialogService,
    private sendFormService: SendFormService,
    private sendPolicyService: SendPolicyService,
  ) {
    this.config = params.formConfig;
    this.init();
  }

  init() {
    this.disableForm = this.params.disableForm ?? this.config.originalSend?.disabled ?? false;
    this.editing.set(this.config.mode === "add");
    this.showCopyButton.set(
      this.config.originalSend?.disabled && this.config.originalSend?.type === SendType.Text,
    );
    this.showTrashIconButton.set(
      this.showCopyButton() || (!this.config.originalSend?.disabled && this.config?.mode !== "add"),
    );
  }

  /**
   * Opens the inline password generator view within the drawer.
   */
  openGenerator() {
    this.showGenerator.set(true);
    this.dialogRef.disableClose = true;
  }

  /**
   * Closes the generator view and applies the generated password.
   */
  useGeneratedPassword() {
    const value = this.generatedValue();
    if (value) {
      this.sendFormComponent()?.sendDetailsComponent()?.setGeneratedPassword(value);
    }
    this.showGenerator.set(false);
    this.generatedValue.set("");
    this.dialogRef.disableClose = false;
  }

  /**
   * Closes the generator view without applying the password.
   */
  closeGenerator() {
    this.showGenerator.set(false);
    this.generatedValue.set("");
    this.dialogRef.disableClose = false;
  }

  /**
   * Handles the value generated by the inline generator.
   */
  onValueGenerated(value: string) {
    this.generatedValue.set(value);
  }

  /**
   * Handles algorithm selection changes from the generator.
   */
  onAlgorithmSelected(selected?: AlgorithmInfo) {
    if (selected) {
      this.generatorButtonLabel.set(selected.useGeneratedValue);
    } else {
      this.generatorButtonLabel.set(this.i18nService.t("useThisPassword"));
    }
    this.generatedValue.set("");
  }

  /**
   * Handles the event when the send is created.
   */
  async onSendCreated(send: SendView) {
    // FIXME Add dialogService.open send-created dialog
    await this.dialogRef.close({ result: SendItemDialogResult.Created, send });
  }

  /**
   * Handles the event when the send is updated.
   */
  async onSendUpdated(send: SendView) {
    await this.dialogRef.close({ result: SendItemDialogResult.Updated, send });
  }

  /**
   * Handles the event when the send is deleted.
   */
  async onSendDeleted() {
    await this.dialogRef.close({ result: SendItemDialogResult.Deleted });

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

  protected editSend() {
    this.editing.set(true);
  }

  protected async cancelEditSend() {
    if (this.config.mode === "add") {
      // For "add" mode, just call close() — the closePredicate wired at open-time
      // (promptForUnsavedEdits) will handle showing the discard dialog exactly once.
      // Calling promptForUnsavedEdits manually here AND then close() would cause the
      // discard dialog to appear twice (once here, once from the closePredicate).
      void this.dialogRef.close();
    } else {
      // For "edit" mode we are not closing the dialog, just toggling back to view mode,
      // so the closePredicate never runs — we must check for unsaved edits manually.
      const proceed = await this.sendFormService.promptForUnsavedEdits();
      if (!proceed) {
        return;
      }
      this.editing.set(false);
    }
  }

  /**
   * Opens the send add/edit dialog.
   * @param dialogService Instance of the DialogService.
   * @param params The parameters for the dialog.
   * @returns The dialog result.
   */
  static open(dialogService: DialogService, params: SendItemDialogParams) {
    return dialogService.open<
      SendItemDialogResult,
      SendItemDialogParams,
      SendAddEditDialogComponent
    >(SendAddEditDialogComponent, {
      data: params,
      closePredicate: params.closePredicate,
    });
  }

  /**
   * Opens the send add/edit dialog in a drawer
   * @param dialogService Instance of the DialogService.
   * @param params The parameters for the drawer.
   * @returns The drawer result.
   */
  static openDrawer(dialogService: DialogService, params: SendItemDialogParams) {
    return dialogService.openDrawer<
      SendItemDialogResult,
      SendItemDialogParams,
      SendAddEditDialogComponent
    >(SendAddEditDialogComponent, {
      data: params,
      closePredicate: params.closePredicate,
    });
  }

  async makeCopy() {
    const originalSendView = this.sendFormService.originalSendView();
    if (!originalSendView) {
      return;
    }
    const hideEmailDisabled = await firstValueFrom(this.sendPolicyService.disableHideEmail$);
    const whoCanAccess = await firstValueFrom(this.sendPolicyService.whoCanAccess$);
    this.config = {
      areSendsAllowed: true,
      mode: "add",
      sendType: originalSendView.type,
      originalSend: null,
      presetSendFields: {
        name: originalSendView.name,
        text: originalSendView.text,
        maxAccessCount: originalSendView.maxAccessCount,
        hideEmail: !hideEmailDisabled && originalSendView.hideEmail,
        notes: originalSendView.notes,
        authType:
          whoCanAccess === WhoCanAccessType.SpecificPeople
            ? AuthType.Email
            : whoCanAccess === WhoCanAccessType.PasswordProtected
              ? AuthType.Password
              : AuthType.None,
      },
    };
    this.init();
  }
}
