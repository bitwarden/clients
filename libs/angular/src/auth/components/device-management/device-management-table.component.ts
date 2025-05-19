import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

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
import { I18nPipe } from "@bitwarden/ui-common";

import { DeviceDisplayData } from "./device-management.component";

/** Displays user devices in a sortable table view */
@Component({
  standalone: true,
  selector: "auth-device-management-table",
  templateUrl: "./device-management-table.component.html",
  imports: [BadgeModule, ButtonModule, CommonModule, I18nPipe, LinkModule, TableModule],
})
export class DeviceManagementTableComponent implements OnInit {
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

  ngOnInit() {
    this.tableDataSource.data = this.devices;
  }

  protected async approveOrDenyAuthRequest(pendingAuthRequest: DevicePendingAuthRequest) {
    const loginApprovalDialog = LoginApprovalComponent.open(this.dialogService, {
      notificationId: pendingAuthRequest.id,
    });

    await firstValueFrom(loginApprovalDialog.closed);
  }
}
