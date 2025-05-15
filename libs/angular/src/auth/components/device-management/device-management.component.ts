import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { DeviceManagementComponentServiceAbstraction } from "@bitwarden/auth/common";
import { DevicesServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices/devices.service.abstraction";
import { DeviceView } from "@bitwarden/common/auth/abstractions/devices/views/device.view";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { ButtonModule, PopoverModule } from "@bitwarden/components";

import { DeviceManagementItemGroupComponent } from "./device-management-item-group.component";
import { DeviceManagementTableComponent } from "./device-management-table.component";

/**
 * The `DeviceManagementComponent` fetches user devices and passes them down
 * to a child component for display.
 *
 * The specific child component that gets displayed depends on the viewport width:
 * - Medium to Large screens = `bit-table` view
 * - Small screens = `bit-item-group` view
 */
@Component({
  standalone: true,
  selector: "auth-device-management",
  templateUrl: "./device-management.component.html",
  imports: [
    ButtonModule,
    CommonModule,
    DeviceManagementItemGroupComponent,
    DeviceManagementTableComponent,
    JslibModule,
    PopoverModule,
  ],
})
export class DeviceManagementComponent implements OnInit {
  protected currentDevice?: DeviceView;
  protected devices?: DeviceView[];
  protected initializing = true;
  protected showHeaderInfo = false;

  constructor(
    private deviceManagementComponentService: DeviceManagementComponentServiceAbstraction,
    private devicesService: DevicesServiceAbstraction,
    private validationService: ValidationService,
  ) {
    this.showHeaderInfo = this.deviceManagementComponentService.showHeaderInformation();
  }

  async ngOnInit() {
    try {
      const currentDevice = await firstValueFrom(this.devicesService.getCurrentDevice$());
      const devices = await firstValueFrom(this.devicesService.getDevices$());

      if (currentDevice && devices) {
        this.currentDevice = new DeviceView(currentDevice);
        this.devices = devices;
      }
    } catch (e) {
      this.validationService.showError(e);
    } finally {
      this.initializing = false;
    }
  }
}
