import { DialogRef } from "@angular/cdk/dialog";
import { Directive, Input } from "@angular/core";
import { firstValueFrom, lastValueFrom } from "rxjs";

import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";

import {
  SendAddEditDialogComponent,
  SendItemDialogResult,
} from "../add-edit/send-add-edit-dialog.component";
import { DefaultSendFormConfigService, SendFormConfig } from "../send-form";

@Directive()
export class SendListItemsContainerBaseComponent {
  /**
   * The list of sends to display.
   */
  @Input()
  sends: SendView[] = [];

  /**
   * Exposes the send type enum to the template.
   */
  protected SendType = SendType;

  private sendItemDialogRef?: DialogRef<SendItemDialogResult> | undefined;

  constructor(
    protected dialogService: DialogService,
    protected environmentService: EnvironmentService,
    protected i18nService: I18nService,
    protected logService: LogService,
    protected platformUtilsService: PlatformUtilsService,
    protected sendApiService: SendApiService,
    protected toastService: ToastService,
    protected addEditFormConfigService: DefaultSendFormConfigService,
  ) {}

  /**
   * Opens or navigates to the platform-specifc Send edit page/dialog
   * @param send The send to edit.
   * */
  async editSend(send: SendView) {
    if (send == null) {
      return;
    }

    const config = await this.addEditFormConfigService.buildConfig(
      "edit",
      send.id as SendId,
      send.type,
    );

    await this.openSendItemDialog(config);
  }

  /**
   * Opens the send item dialog.
   * @param formConfig The form configuration.
   * */
  async openSendItemDialog(formConfig: SendFormConfig) {
    // Prevent multiple dialogs from being opened.
    if (this.sendItemDialogRef) {
      return;
    }

    this.sendItemDialogRef = SendAddEditDialogComponent.open(this.dialogService, {
      formConfig,
    });

    await lastValueFrom(this.sendItemDialogRef.closed);
    this.sendItemDialogRef = undefined;
  }

  /**
   * Deletes a send.
   * @param s The send to delete.
   * @returns A promise that resolves to true if the send was deleted; otherwise, false.
   * */
  async deleteSend(s: SendView): Promise<boolean> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteSend" },
      content: { key: "deleteSendPermanentConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    await this.sendApiService.delete(s.id);

    try {
      this.toastService.showToast({
        variant: "success",
        title: undefined,
        message: this.i18nService.t("deletedSend"),
      });
    } catch (e) {
      this.logService.error(e);
    }
    return true;
  }

  /**
   * Creates a link to the Send, that can be shared and copies the link into the clipboard.
   * @param send The send to copy the link for.
   * */
  async copySendLink(send: SendView) {
    const env = await firstValueFrom(this.environmentService.environment$);
    const link = env.getSendUrl() + send.accessId + "/" + send.urlB64Key;
    this.platformUtilsService.copyToClipboard(link);
    this.toastService.showToast({
      variant: "success",
      title: undefined,
      message: this.i18nService.t("valueCopied", this.i18nService.t("sendLink")),
    });
  }
}
