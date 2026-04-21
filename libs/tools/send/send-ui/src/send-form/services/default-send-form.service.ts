// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { inject, Injectable, signal } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { FormBuilder } from "@angular/forms";
import { firstValueFrom, lastValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Send } from "@bitwarden/common/tools/send/models/domain/send";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";

import { SendItemDialogResult } from "../../add-edit/send-add-edit-dialog.component";
import { SendFormConfig } from "../abstractions/send-form-config.service";
import { SendFormService } from "../abstractions/send-form.service";
import {
  UnsavedEditsDialogComponent,
  UnsavedEditsDialogResult,
} from "../components/unsaved-edits-dialog/unsaved-edits-dialog.component";
import { SendForm } from "../send-form-container";

@Injectable()
export class DefaultSendFormService implements SendFormService {
  private dialogService = inject(DialogService);
  private toastService = inject(ToastService);
  private logService = inject(LogService);
  private formBuilder = inject(FormBuilder);
  private accountService = inject(AccountService);
  private sendApiService = inject(SendApiService);
  private sendService = inject(SendService);
  private i18nService = inject(I18nService);

  private _sendForm = this.formBuilder.group<SendForm>({});
  readonly sendForm = signal(this._sendForm).asReadonly();
  private readonly _submitting = signal(false);
  readonly submitting = toObservable(this._submitting);

  sendFormConfig: SendFormConfig | null = null;

  originalSendView: SendView | null = null;
  private updatedSendView: SendView | null = null;
  private file: File | null = null;

  async decryptSend(send: Send): Promise<SendView> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return await send.decrypt(userId);
  }

  registerChildForm<K extends keyof SendForm>(
    name: K,
    group: Exclude<SendForm[K], undefined>,
  ): void {
    this._sendForm.setControl(name, group);
  }

  patchSend(updateFn: (current: SendView) => SendView): void {
    this.updatedSendView = updateFn(this.updatedSendView);
  }

  setFile(file: File): void {
    this.file = file;
  }

  async initializeSendForm(config: SendFormConfig) {
    this.sendFormConfig = config;
    (Object.keys(this._sendForm.controls) as (keyof SendForm)[]).forEach((key) => {
      this._sendForm.removeControl(key);
    });
    this._sendForm.reset();
    this.file = undefined;
    this.updatedSendView = new SendView();
    if (this.sendFormConfig.mode === "add") {
      this.originalSendView = null;
      this.updatedSendView.type = this.sendFormConfig.sendType;
    } else {
      if (!this.sendFormConfig.originalSend) {
        throw new Error("Original send is required for edit or clone mode");
      }
      this.originalSendView = await this.decryptSend(this.sendFormConfig.originalSend);
      this.updatedSendView = Object.assign(this.updatedSendView, this.originalSendView);
    }
  }

  async submitSendForm() {
    this._submitting.set(true);
    if (this._sendForm.invalid) {
      this._sendForm.markAllAsTouched();
      this._submitting.set(false);
      return;
    }

    try {
      const sendData = await this.sendService.encrypt(
        this.updatedSendView,
        this.file,
        this.updatedSendView.password,
        null,
      );
      const newSend = await this.sendApiService.save(sendData);
      const sendView = await this.decryptSend(newSend);
      this.originalSendView = this.updatedSendView = null;
      this._submitting.set(false);
      return sendView;
    } catch (err) {
      this.logService.error(err);
      this.toastService.showToast({
        message: this.i18nService.t("saveSendEditsFailed"),
        variant: "error",
      });
      this._submitting.set(false);
      return;
    }
  }

  sendFormHasEdits() {
    const replacer = (key: string, value: any) => {
      if (key === "password") {
        // The password is not decrypted on the SendView, so the Send form uses "************" as a stand-in and disables the
        // field (which gives `undefined` in the form value). Therefore the old and new SendViews will never have the same
        // value here
        return undefined;
      } else {
        return value;
      }
    };
    return (
      this.sendForm().touched &&
      JSON.stringify(this.originalSendView, replacer) !==
        JSON.stringify(this.updatedSendView, replacer)
    );
  }

  /**
   * This function is used as a closePredicate for the Send dialog/drawer.
   */
  async promptForUnsavedEdits(result?: SendItemDialogResult): Promise<boolean> {
    // We only have a result if we have successfully saved/deleted the Send already
    if (result?.result) {
      return true;
    }
    if (this.sendFormHasEdits()) {
      const dialogRef = this.dialogService.open<UnsavedEditsDialogResult>(
        UnsavedEditsDialogComponent,
      );
      const unsavedEditsDialogResult = await lastValueFrom(dialogRef.closed);
      if (unsavedEditsDialogResult?.result === UnsavedEditsDialogResult.Discard) {
        this.originalSendView = null;
        this.updatedSendView = null;
        return true;
      } else {
        return false;
      }
    }
    return true;
  }
}
