import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";

import { DevicePendingAuthRequest } from "@bitwarden/common/auth/abstractions/devices/responses/device.response";
import { BadgeModule, ItemModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DeviceDisplayData } from "./device-management.component";

/** Displays user devices in an item list view */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
 
@Component({
  standalone: true,
  selector: "auth-device-management-item-group",
  templateUrl: "./device-management-item-group.component.html",
  imports: [BadgeModule, CommonModule, ItemModule, I18nPipe],
})
export class DeviceManagementItemGroupComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
   
  @Input() devices: DeviceDisplayData[] = [];
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
   
  @Output() onAuthRequestAnswered = new EventEmitter<DevicePendingAuthRequest>();

  protected answerAuthRequest(pendingAuthRequest: DevicePendingAuthRequest | null) {
    if (pendingAuthRequest == null) {
      return;
    }
    this.onAuthRequestAnswered.emit(pendingAuthRequest);
  }
}
