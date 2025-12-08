import { DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
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
} from "@bitwarden/components";

type KeyRotationTrustDialogData = {
  orgName?: string;
  numberOfEmergencyAccessUsers: number;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "key-rotation-trust-info",
  templateUrl: "key-rotation-trust-info.component.html",
  imports: [
    CommonModule,
    JslibModule,
    DialogModule,
    ButtonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    FormsModule,
  ],
})
export class KeyRotationTrustInfoComponent {
  constructor(
    @Inject(DIALOG_DATA) protected params: KeyRotationTrustDialogData,
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
   * @param data The data to pass to the dialog
   */
  static open(dialogService: DialogService, data: KeyRotationTrustDialogData) {
    return dialogService.open<boolean, KeyRotationTrustDialogData>(KeyRotationTrustInfoComponent, {
      data,
    });
  }
}
