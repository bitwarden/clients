// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DialogConfig, DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  DialogService,
  FormFieldModule,
  LinkModule,
  TypographyModule,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

type KeyRotationTrustDialogData = {
  orgName?: string;
  numberOfEmergencyAccessUsers: number;
};

@Component({
  selector: "key-rotation-trust-info",
  templateUrl: "key-rotation-trust-info.component.html",
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
  ],
})
export class KeyRotationTrustInfoComponent {
  constructor(
    @Inject(DIALOG_DATA) protected params: KeyRotationTrustDialogData,
    private keyService: KeyService,
    private logService: LogService,
    private dialogRef: DialogRef<boolean>,
  ) {}

  async submit() {
    try {
      this.dialogRef.close(true);
    } catch (e) {
      this.logService.error(e);
    }
  }
  /**
   * Strongly typed helper to open a KeyRotationTrustComponent
   * @param dialogService Instance of the dialog service that will be used to open the dialog
   * @param config Configuration for the dialog
   */
  static open(dialogService: DialogService, config: DialogConfig<KeyRotationTrustDialogData>) {
    return dialogService.open<boolean>(KeyRotationTrustInfoComponent, config);
  }
}
