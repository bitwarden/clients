import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { LoginApprovalComponent } from "@bitwarden/auth/angular";
import { DevicePendingAuthRequest } from "@bitwarden/common/auth/abstractions/devices/responses/device.response";
import { BadgeModule, DialogService, ItemModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DeviceDisplayData } from "./device-management.component";

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

    await firstValueFrom(loginApprovalDialog.closed);
  }
}
