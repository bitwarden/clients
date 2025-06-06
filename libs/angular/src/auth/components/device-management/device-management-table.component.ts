import { CommonModule } from "@angular/common";
import { Component, Input, OnChanges, SimpleChanges } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LoginApprovalComponent } from "@bitwarden/auth/angular";
import { DevicePendingAuthRequest } from "@bitwarden/common/auth/abstractions/devices/responses/device.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BadgeModule,
  ButtonModule,
  DialogService,
  LinkModule,
  TableDataSource,
  TableModule,
} from "@bitwarden/components";

import { DeviceDisplayData } from "./device-management.component";
import { deviceReSort } from "./device-re-sort.helper";

/** Displays user devices in a sortable table view */
@Component({
  standalone: true,
  selector: "auth-device-management-table",
  templateUrl: "./device-management-table.component.html",
  imports: [BadgeModule, ButtonModule, CommonModule, JslibModule, LinkModule, TableModule],
})
export class DeviceManagementTableComponent implements OnChanges {
  @Input() devices: DeviceDisplayData[] = [];
  protected tableDataSource = new TableDataSource<DeviceDisplayData>();

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
    if (changes.devices) {
      this.tableDataSource.data = this.devices;
    }
  }

  protected async approveOrDenyAuthRequest(pendingAuthRequest: DevicePendingAuthRequest) {
    const loginApprovalDialog = LoginApprovalComponent.open(this.dialogService, {
      notificationId: pendingAuthRequest.id,
    });

    const result = await firstValueFrom(loginApprovalDialog.closed);

    if (result !== undefined && typeof result === "boolean") {
      // Auth request was approved or denied, so clear the
      // pending auth request and re-sort the device array
      const updatedDevices = this.devices
        .map((device) => {
          if (device.pendingAuthRequest?.id === pendingAuthRequest.id) {
            device.pendingAuthRequest = null;
            device.loginStatus = "";
          }
          return device;
        })
        .sort(deviceReSort);

      this.tableDataSource.data = updatedDevices;
    }
  }
}
