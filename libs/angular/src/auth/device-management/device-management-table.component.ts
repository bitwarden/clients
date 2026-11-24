import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from "@angular/core";

import { DevicePendingAuthRequest } from "@bitwarden/common/auth/abstractions/devices/responses/device.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BadgeModule,
  ButtonModule,
  IconModule,
  LinkModule,
  SortFn,
  TableDataSource,
  TableModule,
} from "@bitwarden/components";

import { JslibModule } from "../../jslib.module";

import { DeviceDisplayData } from "./device-management.component";
import { recentlyActiveSortFn } from "./utils/device-sort.utils";

/** Displays user devices in a sortable table view */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  standalone: true,
  selector: "auth-device-management-table",
  templateUrl: "./device-management-table.component.html",
  imports: [
    BadgeModule,
    ButtonModule,
    CommonModule,
    IconModule,
    JslibModule,
    LinkModule,
    TableModule,
  ],
})
export class DeviceManagementTableComponent implements OnChanges {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() devices: DeviceDisplayData[] = [];
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onAuthRequestAnswered = new EventEmitter<DevicePendingAuthRequest>();

  protected tableDataSource = new TableDataSource<DeviceDisplayData>();
  protected readonly columnConfig: {
    name: string;
    title: string;
    headerClass: string;
    sortable: boolean;
    sortFn?: SortFn;
  }[] = [
    {
      name: "displayName",
      title: this.i18nService.t("device"),
      headerClass: "tw-w-1/3",
      sortable: true,
    },
    {
      name: "recentlyActiveText",
      title: this.i18nService.t("recentlyActive"),
      headerClass: "tw-w-1/3",
      sortable: true,
      // recentlyActiveText is a localized display string ("Today", "Yesterday", etc.) so
      // alphabetical sorting is nonsensical. Sort by the underlying date value instead.
      sortFn: recentlyActiveSortFn,
    },
    {
      name: "firstLogin",
      title: this.i18nService.t("firstLogin"),
      headerClass: "tw-w-1/3",
      sortable: true,
    },
  ];

  constructor(private i18nService: I18nService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.devices) {
      this.tableDataSource.data = this.devices;
    }
  }

  resetSort(): void {
    this.tableDataSource.sort = { direction: "asc" };
  }

  protected answerAuthRequest(pendingAuthRequest: DevicePendingAuthRequest | null) {
    if (pendingAuthRequest == null) {
      return;
    }
    this.onAuthRequestAnswered.emit(pendingAuthRequest);
  }
}
