import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { catchError, combineLatest, finalize, map, Observable, of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { DeviceManagementComponentServiceAbstraction } from "@bitwarden/auth/common";
import { DevicesServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices/devices.service.abstraction";
import {
  DevicePendingAuthRequest,
  DeviceResponse,
} from "@bitwarden/common/auth/abstractions/devices/responses/device.response";
import { DeviceView } from "@bitwarden/common/auth/abstractions/devices/views/device.view";
import { DeviceType, DeviceTypeMetadata } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ButtonModule, PopoverModule } from "@bitwarden/components";

import { DeviceManagementItemGroupComponent } from "./device-management-item-group.component";
import { DeviceManagementTableComponent } from "./device-management-table.component";

export interface DeviceDisplayData {
  displayName: string;
  firstLogin: Date;
  icon: string;
  id: string;
  isCurrentDevice: boolean;
  isTrusted: boolean;
  loginStatus: string;
  pendingAuthRequest: DevicePendingAuthRequest | null;
}

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
export class DeviceManagementComponent {
  protected initializing = true;
  protected showHeaderInfo = false;

  protected devices$: Observable<DeviceDisplayData[]> = combineLatest([
    this.devicesService.getDevices$(),
    this.devicesService.getCurrentDevice$(),
  ]).pipe(
    map(([devices, currentDevice]) => this.mapDevicesToDisplayData(devices, currentDevice)),
    catchError(() => of([])),
    finalize(() => (this.initializing = false)),
  );

  constructor(
    private deviceManagementComponentService: DeviceManagementComponentServiceAbstraction,
    private devicesService: DevicesServiceAbstraction,
    private i18nService: I18nService,
  ) {
    this.showHeaderInfo = this.deviceManagementComponentService.showHeaderInformation();
  }

  private mapDevicesToDisplayData(
    devices: DeviceView[],
    currentDevice: DeviceResponse,
  ): DeviceDisplayData[] {
    return devices.map((device) => ({
      displayName: this.getReadableDeviceTypeName(device.type),

      firstLogin: device.creationDate ? new Date(device.creationDate) : new Date(),

      icon: this.getDeviceIcon(device.type),

      id: device.id || "",

      isCurrentDevice: this.isCurrentDevice(device, currentDevice),

      isTrusted: device.response?.isTrusted,

      loginStatus: this.getLoginStatus(device, currentDevice),

      pendingAuthRequest: device.response?.devicePendingAuthRequest,
    }));
  }

  private getLoginStatus(device: DeviceView, currentDevice: DeviceResponse): string {
    if (this.isCurrentDevice(device, currentDevice)) {
      return this.i18nService.t("currentSession");
    }

    if (this.hasPendingAuthRequest(device)) {
      return this.i18nService.t("requestPending");
    }

    return "";
  }

  private isCurrentDevice(device: DeviceView, currentDevice: DeviceResponse): boolean {
    return device.id === currentDevice.id;
  }

  private hasPendingAuthRequest(device: DeviceView): boolean {
    return device.response?.devicePendingAuthRequest != null;
  }

  private getDeviceIcon(type: DeviceType): string {
    const defaultIcon = "bwi bwi-desktop";
    const categoryIconMap: Record<string, string> = {
      webVault: "bwi bwi-browser",
      desktop: "bwi bwi-desktop",
      mobile: "bwi bwi-mobile",
      cli: "bwi bwi-cli",
      extension: "bwi bwi-puzzle",
      sdk: "bwi bwi-desktop",
    };

    const metadata = DeviceTypeMetadata[type];
    return metadata ? (categoryIconMap[metadata.category] ?? defaultIcon) : defaultIcon;
  }

  getReadableDeviceTypeName(type: DeviceType): string {
    if (type === undefined) {
      return this.i18nService.t("unknownDevice");
    }

    const metadata = DeviceTypeMetadata[type];
    if (!metadata) {
      return this.i18nService.t("unknownDevice");
    }

    const platform =
      metadata.platform === "Unknown" ? this.i18nService.t("unknown") : metadata.platform;
    const category = this.i18nService.t(metadata.category);
    return platform ? `${category} - ${platform}` : category;
  }
}
