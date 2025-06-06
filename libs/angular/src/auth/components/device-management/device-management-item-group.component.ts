import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { LoginApprovalComponent } from "@bitwarden/auth/angular";
import { DevicePendingAuthRequest } from "@bitwarden/common/auth/abstractions/devices/responses/device.response";
import { BadgeModule, DialogService, ItemModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DeviceDisplayData } from "./device-management.component";
import { deviceReSort } from "./device-re-sort.helper";

/** Displays user devices in an item list view */
@Component({
  standalone: true,
  selector: "auth-device-management-item-group",
  templateUrl: "./device-management-item-group.component.html",
  imports: [BadgeModule, CommonModule, ItemModule, I18nPipe],
})
export class DeviceManagementItemGroupComponent {
  @Input() devices: DeviceDisplayData[] = [];

  constructor(private dialogService: DialogService) {}

  protected async approveOrDenyAuthRequest(pendingAuthRequest: DevicePendingAuthRequest) {
    const loginApprovalDialog = LoginApprovalComponent.open(this.dialogService, {
      notificationId: pendingAuthRequest.id,
    });

    const result = await firstValueFrom(loginApprovalDialog.closed);

    if (result !== undefined && typeof result === "boolean") {
      // Auth request was approved or denied, so clear the
      // pending auth request and re-sort the device array
      const updatedDevices = this.devices
        .map((device) => {
          if (device.pendingAuthRequest?.id === pendingAuthRequest.id) {
            device.pendingAuthRequest = null;
            device.loginStatus = "";
          }
          return device;
        })
        .sort(deviceReSort);

      this.devices = updatedDevices;
    }
  }
}
