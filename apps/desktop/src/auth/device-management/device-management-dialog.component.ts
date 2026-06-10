import { Component } from "@angular/core";

import { DeviceManagementComponent } from "@bitwarden/angular/auth/device-management/device-management.component";
import { DialogModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Temporary dialog wrapper for device management until desktop UI refresh adds proper settings routes.
 * TODO: Remove this dialog once desktop has a dedicated settings section in the new UI
 */
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-device-management-dialog",
  templateUrl: "device-management-dialog.component.html",
  imports: [DialogModule, I18nPipe, DeviceManagementComponent],
})
export class DeviceManagementDialogComponent {
  constructor() {}
}
