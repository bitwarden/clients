import { Component } from "@angular/core";

import { DeviceManagementComponent } from "@bitwarden/angular/auth/device-management/device-management.component";
import { I18nPipe } from "@bitwarden/ui-common";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

@Component({
  standalone: true,
  selector: "extension-device-management",
  templateUrl: "extension-device-management.component.html",
  imports: [
    DeviceManagementComponent,
    I18nPipe,
    PopOutComponent,
    PopupHeaderComponent,
    PopupPageComponent,
  ],
})
export class ExtensionDeviceManagementComponent {}
