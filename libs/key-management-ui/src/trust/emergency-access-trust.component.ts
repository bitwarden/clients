import { DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
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

type EmergencyAccessTrustDialogData = {
  /** display name of the user */
  name: string;
  /** userid  of the user */
  userId: string;
  /** user public key */
  publicKey: Uint8Array;
};
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "emergency-access-trust",
  templateUrl: "emergency-access-trust.component.html",
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
export class EmergencyAccessTrustComponent implements OnInit {
  loading = true;
  fingerprint: string = "";
  confirmForm = this.formBuilder.group({});

  constructor(
    @Inject(DIALOG_DATA) protected params: EmergencyAccessTrustDialogData,
    private formBuilder: FormBuilder,
    private keyService: KeyService,
    private logService: LogService,
    private dialogRef: DialogRef<boolean, EmergencyAccessTrustComponent>,
  ) {}

  async ngOnInit() {
    try {
      const fingerprint = await this.keyService.getFingerprint(
        this.params.userId,
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

  async submit() {
    if (this.loading) {
      return;
    }

    this.dialogRef.close(true);
  }
  /**
   * Strongly typed helper to open a EmergencyAccessTrustComponent
   * @param dialogService Instance of the dialog service that will be used to open the dialog
   * @param data The data to pass to the dialog
   */
  static open(dialogService: DialogService, data: EmergencyAccessTrustDialogData) {
    return dialogService.open<boolean, EmergencyAccessTrustDialogData>(
      EmergencyAccessTrustComponent,
      {
        data,
      },
    );
  }
}
