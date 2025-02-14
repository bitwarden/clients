// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DialogConfig, DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, OnInit, Inject } from "@angular/core";
import { FormBuilder, FormsModule, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  DialogModule,
  DialogService,
  FormFieldModule,
  LinkModule,
  TypographyModule,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

export enum AccountRecoveryTrustDialogResult {
  Trusted = "trusted",
}
type AccountRecoveryTrustDialogData = {
  /** display name of the user */
  name: string;
  /** org id */
  orgId: string;
  /** org public key */
  publicKey: Uint8Array;
};
@Component({
  selector: "account-recovery-trust",
  templateUrl: "account-recovery-trust.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    DialogModule,
    ButtonModule,
    LinkModule,
    TypographyModule,
    ReactiveFormsModule,
    FormFieldModule,
    AsyncActionsModule,
    FormsModule,
    CalloutModule,
  ],
})
export class AccountRecoveryTrustComponent implements OnInit {
  loading = true;
  fingerprint: string;
  confirmForm = this.formBuilder.group({});

  constructor(
    @Inject(DIALOG_DATA) protected params: AccountRecoveryTrustDialogData,
    private formBuilder: FormBuilder,
    private keyService: KeyService,
    private logService: LogService,
    private dialogRef: DialogRef<AccountRecoveryTrustDialogResult>,
  ) {}

  async ngOnInit() {
    try {
      const fingerprint = await this.keyService.getFingerprint(
        this.params.orgId,
        this.params.publicKey,
      );
      if (fingerprint != null) {
        this.fingerprint = fingerprint.join("-");
      }
    } catch (e) {
      this.logService.error(e);
    }
    this.loading = false;
  }

  async submit(trusted: boolean) {
    if (this.loading) {
      return;
    }

    try {
      this.dialogRef.close(AccountRecoveryTrustDialogResult.Trusted);
    } catch (e) {
      this.logService.error(e);
    }
  }
  /**
   * Strongly typed helper to open a AccountRecoveryTrustComponent
   * @param dialogService Instance of the dialog service that will be used to open the dialog
   * @param config Configuration for the dialog
   */
  static open(dialogService: DialogService, config: DialogConfig<AccountRecoveryTrustDialogData>) {
    return dialogService.open<AccountRecoveryTrustDialogResult>(
      AccountRecoveryTrustComponent,
      config,
    );
  }
}
