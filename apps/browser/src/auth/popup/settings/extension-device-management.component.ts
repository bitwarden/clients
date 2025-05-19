import { Component } from "@angular/core";
import { RouterModule } from "@angular/router";

import { DeviceManagementComponent } from "@bitwarden/angular/auth/components/device-management/device-management.component";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ItemModule } from "@bitwarden/components";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

@Component({
  standalone: true,
  selector: "extension-device-management",
  templateUrl: "extension-device-management.component.html",
  imports: [
    JslibModule,
    PopOutComponent,
    PopupHeaderComponent,
    PopupPageComponent,
    RouterModule,
    ItemModule,
    DeviceManagementComponent,
  ],
})
export class ExtensionDeviceManagementComponent {}
