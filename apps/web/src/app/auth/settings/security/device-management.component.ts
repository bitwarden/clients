import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { combineLatest, firstValueFrom } from "rxjs";

import { LoginApprovalComponent } from "@bitwarden/auth/angular";
import { DevicesServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices/devices.service.abstraction";
import {
  DevicePendingAuthRequest,
  DeviceResponse,
} from "@bitwarden/common/auth/abstractions/devices/responses/device.response";
import { DeviceView } from "@bitwarden/common/auth/abstractions/devices/views/device.view";
import { DeviceType, DeviceTypeMetadata } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import {
  DialogService,
  ToastService,
  TableDataSource,
  TableModule,
  PopoverModule,
} from "@bitwarden/components";

import { SharedModule } from "../../../shared";

interface DeviceTableData {
  id: string;
  type: DeviceType;
  displayName: string;
  loginStatus: string;
  firstLogin: Date;
  trusted: boolean;
  devicePendingAuthRequest: DevicePendingAuthRequest | null;
  hasPendingAuthRequest: boolean;
}

/**
 * Provides a table of devices and allows the user to log out, approve or remove a device
 */
@Component({
  selector: "app-device-management",
  templateUrl: "./device-management.component.html",
  standalone: true,
  imports: [CommonModule, SharedModule, TableModule, PopoverModule],
})
export class DeviceManagementComponent {
  protected readonly tableId = "device-management-table";
  protected dataSource = new TableDataSource<DeviceTableData>();
  protected currentDevice: DeviceView | undefined;
  protected loading = true;
  protected asyncActionLoading = false;

  constructor(
    private i18nService: I18nService,
    private devicesService: DevicesServiceAbstraction,
    private dialogService: DialogService,
    private toastService: ToastService,
    private validationService: ValidationService,
  ) {
    combineLatest([this.devicesService.getCurrentDevice$(), this.devicesService.getDevices$()])
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: ([currentDevice, devices]: [DeviceResponse, Array<DeviceView>]) => {
          this.currentDevice = new DeviceView(currentDevice);

          this.dataSource.data = devices.map((device: DeviceView): DeviceTableData => {
            return {
              id: device.id,
              type: device.type,
              displayName: this.getHumanReadableDeviceType(device.type),
              loginStatus: this.getLoginStatus(device),
              firstLogin: new Date(device.creationDate),
              trusted: device.response.isTrusted,
              devicePendingAuthRequest: device.response.devicePendingAuthRequest,
              hasPendingAuthRequest: this.hasPendingAuthRequest(device.response),
            };
          });

          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  /**
   * Column configuration for the table
   */
  protected readonly columnConfig = [
    {
      name: "displayName",
      title: this.i18nService.t("device"),
      headerClass: "tw-w-1/3",
      sortable: true,
    },
    {
      name: "loginStatus",
      title: this.i18nService.t("loginStatus"),
      headerClass: "tw-w-1/3",
      sortable: true,
    },
    {
      name: "firstLogin",
      title: this.i18nService.t("firstLogin"),
      headerClass: "tw-w-1/3",
      sortable: true,
    },
  ];

  /**
   * Get the icon for a device type
   * @param type - The device type
   * @returns The icon for the device type
   */
  getDeviceIcon(type: DeviceType): string {
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

  /**
   * Get the login status of a device
   * It will return the current session if the device is the current device
   * It will return the date of the pending auth request when available
   * @param device - The device
   * @returns The login status
   */
  private getLoginStatus(device: DeviceView): string {
    if (this.isCurrentDevice(device)) {
      return this.i18nService.t("currentSession");
    }

    if (device.response.devicePendingAuthRequest?.creationDate) {
      return this.i18nService.t("requestPending");
    }

    return "";
  }

  /**
   * Get a human readable device type from the DeviceType enum
   * @param type - The device type
   * @returns The human readable device type
   */
  private getHumanReadableDeviceType(type: DeviceType): string {
    const metadata = DeviceTypeMetadata[type];
    if (!metadata) {
      return this.i18nService.t("unknownDevice");
    }

    // If the platform is "Unknown" translate it since it is not a proper noun
    const platform =
      metadata.platform === "Unknown" ? this.i18nService.t("unknown") : metadata.platform;
    const category = this.i18nService.t(metadata.category);
    return platform ? `${category} - ${platform}` : category;
  }

  /**
   * Check if a device is the current device
   * @param device - The device or device table data
   * @returns True if the device is the current device, false otherwise
   */
  protected isCurrentDevice(device: DeviceView | DeviceTableData): boolean {
    return "response" in device
      ? device.id === this.currentDevice?.id
      : device.id === this.currentDevice?.id;
  }

  /**
   * Check if a device has a pending auth request
   * @param device - The device response
   * @returns True if the device has a pending auth request, false otherwise
   */
  private hasPendingAuthRequest(device: DeviceResponse): boolean {
    return (
      device.devicePendingAuthRequest !== undefined && device.devicePendingAuthRequest !== null
    );
  }

  /**
   * Open a dialog to approve or deny a pending auth request for a device
   */
  async managePendingAuthRequest(device: DeviceTableData) {
    if (device.devicePendingAuthRequest === undefined || device.devicePendingAuthRequest === null) {
      return;
    }

    const dialogRef = LoginApprovalComponent.open(this.dialogService, {
      notificationId: device.devicePendingAuthRequest.id,
    });

    const result = await firstValueFrom(dialogRef.closed);

    if (result !== undefined && typeof result === "boolean") {
      // auth request approved or denied so reset
      device.devicePendingAuthRequest = null;
      device.hasPendingAuthRequest = false;
    }
  }

  /**
   * Remove a device
   * @param device - The device
   */
  protected async removeDevice(device: DeviceTableData) {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "removeDevice" },
      content: { key: "removeDeviceConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      this.asyncActionLoading = true;
      await firstValueFrom(this.devicesService.deactivateDevice$(device.id));
      this.asyncActionLoading = false;

      // Remove the device from the data source
      this.dataSource.data = this.dataSource.data.filter((d) => d.id !== device.id);

      this.toastService.showToast({
        title: "",
        message: this.i18nService.t("deviceRemoved"),
        variant: "success",
      });
    } catch (error) {
      this.validationService.showError(error);
    }
  }
}
