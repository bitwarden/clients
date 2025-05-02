import { CommonModule } from "@angular/common";
import { Component, Input, OnChanges, SimpleChanges } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LoginApprovalComponent } from "@bitwarden/auth/angular";
import { DeviceView } from "@bitwarden/common/auth/abstractions/devices/views/device.view";
import { DeviceType, DeviceTypeMetadata } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BadgeModule,
  DialogService,
  LinkModule,
  TableDataSource,
  TableModule,
} from "@bitwarden/components";

/**
 * Table-based view for device management
 * Shows devices in a sortable table format
 */
@Component({
  selector: "auth-device-management-table",
  templateUrl: "./device-management-table.component.html",
  standalone: true,
  imports: [CommonModule, JslibModule, BadgeModule, LinkModule, TableModule],
})
export class DeviceManagementTableComponent implements OnChanges {
  @Input() devices: DeviceView[] = [];
  @Input() currentDevice: DeviceView | undefined;

  protected dataSource = new TableDataSource<DeviceView>();

  constructor(
    private i18nService: I18nService,
    private dialogService: DialogService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["devices"]) {
      this.dataSource.data = this.devices;
    }
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
   * Check if a device is the current device
   */
  isCurrentDevice(device: DeviceView): boolean {
    return device.id === this.currentDevice?.id;
  }

  /**
   * Check if a device has a pending auth request
   */
  hasPendingAuthRequest(device: DeviceView): boolean {
    return device.response?.devicePendingAuthRequest != null;
  }

  /**
   * Get the icon for a device type
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
  async managePendingAuthRequest(device: DeviceView) {
    if (!device.response?.devicePendingAuthRequest) {
      return;
    }

    const dialogRef = LoginApprovalComponent.open(this.dialogService, {
      notificationId: device.response.devicePendingAuthRequest.id,
    });

    await dialogRef.closed.toPromise();
  }
}
