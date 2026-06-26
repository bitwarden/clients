// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { inject, Injectable, signal } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { FormBuilder } from "@angular/forms";
import { firstValueFrom, lastValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { WhoCanAccessType } from "@bitwarden/common/tools/models/send-who-can-access-type";
import { Send } from "@bitwarden/common/tools/send/models/domain/send";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { DialogService, ToastService } from "@bitwarden/components";

import { SendItemDialogResult } from "../../add-edit/send-add-edit-dialog.component";
import { SendPolicyService } from "../../services/send-policy.service";
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
  private formBuilder = inject(FormBuilder);
  private accountService = inject(AccountService);
  private sendApiService = inject(SendApiService);
  private sendService = inject(SendService);
  private i18nService = inject(I18nService);
  private sendPolicyService = inject(SendPolicyService);

  private _sendForm = this.formBuilder.group<SendForm>({});
  readonly sendForm = signal(this._sendForm).asReadonly();
  private readonly _submitting = signal(false);
  readonly submitting = toObservable(this._submitting);

  sendFormConfig: SendFormConfig | null = null;

  private readonly _originalSendView = signal<SendView | null>(null);
  readonly originalSendView = this._originalSendView.asReadonly();
  private readonly _updatedSendView = signal<SendView | null>(null);
  readonly updatedSendView = this._updatedSendView.asReadonly();
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
    this._updatedSendView.set(updateFn(this._updatedSendView()));
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
    let originalSendView: SendView | null = null;
    let updatedSendView = new SendView();
    if (this.sendFormConfig.mode === "add") {
      updatedSendView.type = this.sendFormConfig.sendType;
      const whoCanAccess = await firstValueFrom(this.sendPolicyService.whoCanAccess$);
      if (whoCanAccess === WhoCanAccessType.PasswordProtected) {
        updatedSendView.authType = AuthType.Password;
      } else if (whoCanAccess === WhoCanAccessType.SpecificPeople) {
        updatedSendView.authType = AuthType.Email;
      }
      updatedSendView = Object.assign(updatedSendView, this.sendFormConfig.presetSendFields ?? {});
    } else {
      if (!this.sendFormConfig.originalSend) {
        throw new Error("Original send is required for edit or clone mode");
      }
      originalSendView = await this.decryptSend(this.sendFormConfig.originalSend);
      updatedSendView = Object.assign(updatedSendView, originalSendView);
    }
    this._originalSendView.set(originalSendView);
    this._updatedSendView.set(updatedSendView);
  }

  async submitSendForm() {
    this._submitting.set(true);
    if (this._sendForm.invalid) {
      this._sendForm.markAllAsTouched();
      this._submitting.set(false);
      return;
    }

    if (this._updatedSendView()?.hideEmail === true) {
      const disableHideEmail = await firstValueFrom(this.sendPolicyService.disableHideEmail$);
      if (disableHideEmail) {
        this.toastService.showToast({
          message: this.i18nService.t(
            "hideEmailPolicyInEffect",
            this.i18nService.t("hideYourEmail"),
          ),
          variant: "error",
        });
        this._submitting.set(false);
        return;
      }
    }

    let sendView: SendView;
    try {
      const sendData = await this.sendService.encrypt(
        this.updatedSendView(),
        this.file,
        this.updatedSendView().password,
        null,
      );
      const newSend = await this.sendApiService.save(sendData);
      sendView = await this.decryptSend(newSend);
    } catch (err) {
      // We surface any errors but make sure that the submitting
      // status signal is set to false before we do
      this._submitting.set(false);
      throw err;
    }

    this._originalSendView.set(null);
    this._updatedSendView.set(null);
    this._submitting.set(false);

    return sendView;
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
      JSON.stringify(this._originalSendView(), replacer) !==
        JSON.stringify(this._updatedSendView(), replacer)
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
        // Reset the form's touched state so sendFormHasEdits() returns
        // false after the user discards. Without this, the browser's beforeunload
        // (in send.component.ts) would still fire when the user tries
        this._sendForm.markAsUntouched();
        return true;
      } else {
        return false;
      }
    }
    return true;
  }

  async removeSendPassword(): Promise<boolean> {
    const originalSendViewId = this.originalSendView()?.id;
    if (!originalSendViewId) {
      return false;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "removePassword" },
      content: { key: "removePasswordConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    await this.sendApiService.removePassword(originalSendViewId);

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("removedPassword"),
    });

    const updatedSend = await firstValueFrom(this.sendService.get$(this._originalSendView().id));
    const updatedSendView = await this.decryptSend(updatedSend);
    this._originalSendView.set(updatedSendView);
    return true;
  }
}
