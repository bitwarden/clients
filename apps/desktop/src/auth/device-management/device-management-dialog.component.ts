import { DialogRef } from "@angular/cdk/dialog";
import { Component } from "@angular/core";

import { DeviceManagementComponent } from "@bitwarden/angular/auth/device-management/device-management.component";
import { ButtonModule, DialogModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Temporary dialog wrapper for device management until desktop UI refresh adds proper settings routes.
 * TODO: PM-34438 - Remove this dialog once desktop has a dedicated settings section in the new UI
 */
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-device-management-dialog",
  templateUrl: "device-management-dialog.component.html",
  imports: [DialogModule, ButtonModule, I18nPipe, DeviceManagementComponent],
})
export class DeviceManagementDialogComponent {
  constructor(private dialogRef: DialogRef) {}

  close() {
    this.dialogRef.close();
  }
}
