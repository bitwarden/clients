import { CommonModule } from "@angular/common";
import { Component, DestroyRef, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { firstValueFrom } from "rxjs";

import {
  AuthRequestApiService,
  DeviceManagementComponentServiceAbstraction,
} from "@bitwarden/auth/common";
import { DevicesServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices/devices.service.abstraction";
import {
  DevicePendingAuthRequest,
  DeviceResponse,
} from "@bitwarden/common/auth/abstractions/devices/responses/device.response";
import { DeviceView } from "@bitwarden/common/auth/abstractions/devices/views/device.view";
import { DeviceType, DeviceTypeMetadata } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { MessageListener } from "@bitwarden/common/platform/messaging";
import { ButtonModule, PopoverModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DeviceManagementItemGroupComponent } from "./device-management-item-group.component";
import { DeviceManagementTableComponent } from "./device-management-table.component";

export interface DeviceDisplayData {
  displayName: string;
  firstLogin: Date;
  icon: string;
  id: string;
  identifier: string;
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
    I18nPipe,
    PopoverModule,
  ],
})
export class DeviceManagementComponent implements OnInit {
  protected devices: DeviceDisplayData[] = [];
  protected initializing = true;
  protected showHeaderInfo = false;

  constructor(
    private authRequestApiService: AuthRequestApiService,
    private destroyRef: DestroyRef,
    private deviceManagementComponentService: DeviceManagementComponentServiceAbstraction,
    private devicesService: DevicesServiceAbstraction,
    private i18nService: I18nService,
    private messageListener: MessageListener,
    private validationService: ValidationService,
  ) {
    this.showHeaderInfo = this.deviceManagementComponentService.showHeaderInformation();
  }

  async ngOnInit() {
    await this.loadDevices();

    this.messageListener.allMessages$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((message) => {
        if (
          message.command === "openLoginApproval" &&
          message.notificationId &&
          typeof message.notificationId === "string"
        ) {
          void this.upsertDeviceWithPendingAuthRequest(message.notificationId);
        }
      });
  }

  async loadDevices() {
    try {
      const devices = await firstValueFrom(this.devicesService.getDevices$());
      const currentDevice = await firstValueFrom(this.devicesService.getCurrentDevice$());

      if (!devices || !currentDevice) {
        return;
      }

      this.devices = this.mapDevicesToDisplayData(devices, currentDevice);
    } catch (e) {
      this.validationService.showError(e);
    } finally {
      this.initializing = false;
    }
  }

  private mapDevicesToDisplayData(
    devices: DeviceView[],
    currentDevice: DeviceResponse,
  ): DeviceDisplayData[] {
    return devices
      .map((device): DeviceDisplayData => {
        if (!device.id) {
          this.validationService.showError(new Error(this.i18nService.t("deviceIdMissing")));
          return null;
        }

        if (device.type == undefined) {
          this.validationService.showError(new Error(this.i18nService.t("deviceTypeMissing")));
          return null;
        }

        if (!device.creationDate) {
          this.validationService.showError(
            new Error(this.i18nService.t("deviceCreationDateMissing")),
          );
          return null;
        }

        return {
          displayName: this.getReadableDeviceTypeName(device.type),
          firstLogin: device.creationDate ? new Date(device.creationDate) : new Date(),
          icon: this.getDeviceIcon(device.type),
          id: device.id || "",
          identifier: device.identifier ?? "",
          isCurrentDevice: this.isCurrentDevice(device, currentDevice),
          isTrusted: device.response?.isTrusted,
          loginStatus: this.getLoginStatus(device, currentDevice),
          pendingAuthRequest: device.response?.devicePendingAuthRequest,
        };
      })
      .filter((device) => device !== null);
  }

  private async upsertDeviceWithPendingAuthRequest(authRequestId: string) {
    const authRequestResponse = await this.authRequestApiService.getAuthRequest(authRequestId);
    if (!authRequestResponse) {
      return;
    }

    const upsertDevice: DeviceDisplayData = {
      displayName: this.getReadableDeviceTypeName(authRequestResponse.requestDeviceTypeValue),
      firstLogin: new Date(authRequestResponse.creationDate),
      icon: this.getDeviceIcon(authRequestResponse.requestDeviceTypeValue),
      id: "",
      identifier: authRequestResponse.requestDeviceIdentifier,
      isCurrentDevice: false,
      isTrusted: false,
      loginStatus: this.i18nService.t("requestPending"),
      pendingAuthRequest: {
        id: authRequestResponse.id,
        creationDate: authRequestResponse.creationDate,
      },
    };

    // If the device already exists in the DB, update the device id and first login date
    if (authRequestResponse.requestDeviceIdentifier) {
      const existingDevice = await firstValueFrom(
        this.devicesService.getDeviceByIdentifier$(authRequestResponse.requestDeviceIdentifier),
      );

      if (existingDevice?.id && existingDevice.creationDate) {
        upsertDevice.id = existingDevice.id;
        upsertDevice.firstLogin = new Date(existingDevice.creationDate);
      }
    }

    const existingDeviceIndex = this.devices.findIndex(
      (device) => device.identifier === upsertDevice.identifier,
    );

    if (existingDeviceIndex >= 0) {
      // Update existing device in device list
      this.devices[existingDeviceIndex] = upsertDevice;
      this.devices = [...this.devices];
    } else {
      // Add new device to device list
      this.devices = [upsertDevice, ...this.devices];
    }
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
