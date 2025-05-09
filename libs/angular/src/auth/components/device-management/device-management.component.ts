import { CommonModule } from "@angular/common";
import { Component, DestroyRef, OnInit, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { DeviceManagementComponentServiceAbstraction } from "@bitwarden/auth/common";
import { DevicesServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices/devices.service.abstraction";
import { DeviceView } from "@bitwarden/common/auth/abstractions/devices/views/device.view";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { ButtonModule, PopoverModule } from "@bitwarden/components";

import { DeviceManagementItemGroupComponent } from "./device-management-item-group.component";
import { DeviceManagementTableComponent } from "./device-management-table.component";

/**
 * Parent component that decides which view to render based on viewport width
 * Responsible for fetching device data for child components
 */
@Component({
  selector: "auth-device-management",
  templateUrl: "./device-management.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    ButtonModule,
    PopoverModule,
    DeviceManagementTableComponent,
    DeviceManagementItemGroupComponent,
  ],
})
export class DeviceManagementComponent implements OnInit {
  protected loading = true;
  protected asyncActionLoading = false;
  protected devices: DeviceView[] = [];
  protected currentDevice: DeviceView | undefined;

  private destroyRef = inject(DestroyRef);

  constructor(
    protected deviceManagementComponentService: DeviceManagementComponentServiceAbstraction,
    private devicesService: DevicesServiceAbstraction,
    private i18nService: I18nService,
    private validationService: ValidationService,
  ) {}

  async ngOnInit() {
    try {
      await this.loadDevices();
    } catch (error) {
      this.validationService.showError(error);
    }
  }

  /**
   * Load current device and all devices
   */
  private async loadDevices(): Promise<void> {
    try {
      const currentDevice = await firstValueFrom(this.devicesService.getCurrentDevice$());
      const devices = await firstValueFrom(this.devicesService.getDevices$());

      if (!currentDevice || !devices) {
        this.loading = false;
        return;
      }

      this.currentDevice = new DeviceView(currentDevice);
      this.devices = devices;
    } catch (error) {
      this.validationService.showError(error);
    } finally {
      this.loading = false;
    }
  }
}
