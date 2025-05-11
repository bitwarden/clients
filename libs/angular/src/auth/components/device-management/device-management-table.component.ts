import { CommonModule } from "@angular/common";
import { Component, Input, OnChanges, SimpleChanges } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LoginApprovalComponent } from "@bitwarden/auth/angular";
import { DevicePendingAuthRequest } from "@bitwarden/common/auth/abstractions/devices/responses/device.response";
import { DeviceView } from "@bitwarden/common/auth/abstractions/devices/views/device.view";
import { DeviceType, DeviceTypeMetadata } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BadgeModule,
  ButtonModule,
  DialogService,
  LinkModule,
  TableDataSource,
  TableModule,
} from "@bitwarden/components";

/**
 * Interface for device data in a sortable format
 */
interface DeviceTableData {
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
 * Displays a sortable table view of user dervices
 */
@Component({
  standalone: true,
  selector: "auth-device-management-table",
  templateUrl: "./device-management-table.component.html",
  imports: [BadgeModule, ButtonModule, CommonModule, JslibModule, LinkModule, TableModule],
})
export class DeviceManagementTableComponent implements OnChanges {
  @Input() currentDevice?: DeviceView;
  @Input() devices: DeviceView[] = [];

  protected dataSource = new TableDataSource<DeviceTableData>();

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

  constructor(
    private i18nService: I18nService,
    private dialogService: DialogService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["devices"]) {
      this.dataSource.data = this.mapDevicesToTableData(this.devices);
    }
  }

  /**
   * Maps DeviceView objects to table data format for sorting
   */
  private mapDevicesToTableData(devices: DeviceView[]): DeviceTableData[] {
    return devices.map(
      (device: DeviceView): DeviceTableData => ({
        id: device.id || "",
        displayName:
          device.type !== undefined
            ? this.getDeviceTypeName(device.type)
            : this.i18nService.t("unknownDevice"),
        loginStatus: this.getLoginStatus(device),
        firstLogin: device.creationDate ? new Date(device.creationDate) : new Date(),

        isTrusted: device.response?.isTrusted,
        isCurrentDevice: this.isCurrentDevice(device),
        icon: this.getDeviceIcon(device.type),
        pendingAuthRequest: device.response?.devicePendingAuthRequest,
      }),
    );
  }

  private getLoginStatus(device: DeviceView): string {
    if (this.isCurrentDevice(device)) {
      return this.i18nService.t("currentSession");
    }

    if (this.hasPendingAuthRequest(device)) {
      return this.i18nService.t("requestPending");
    }

    return "";
  }

  private isCurrentDevice(device: DeviceView): boolean {
    return device.id === this.currentDevice?.id;
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

  /**
   * Get a human readable device type
   */
  getDeviceTypeName(type: DeviceType): string {
    const metadata = DeviceTypeMetadata[type];
    if (!metadata) {
      return this.i18nService.t("unknownDevice");
    }

    const platform =
      metadata.platform === "Unknown" ? this.i18nService.t("unknown") : metadata.platform;
    const category = this.i18nService.t(metadata.category);
    return platform ? `${category} - ${platform}` : category;
  }

  /**
   * Open a dialog to approve or deny a pending auth request for a device
   */
  protected async managePendingAuthRequest(pendingAuthRequest: DevicePendingAuthRequest) {
    const dialogRef = LoginApprovalComponent.open(this.dialogService, {
      notificationId: pendingAuthRequest.id,
    });

    await dialogRef.closed.toPromise();
  }
}
