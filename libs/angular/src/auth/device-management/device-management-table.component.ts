import { CommonModule } from "@angular/common";
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
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
export class DeviceManagementTableComponent implements OnChanges, OnInit {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() devices: DeviceDisplayData[] = [];
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // TODO: PM-34091 - Remove this input and simplify ngOnInit to always use the "recentlyActive" column.
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showRecentlyActive = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onAuthRequestAnswered = new EventEmitter<DevicePendingAuthRequest>();

  protected tableDataSource = new TableDataSource<DeviceDisplayData>();
  protected columnConfig: {
    name: string;
    title: string;
    headerClass: string;
    sortable: boolean;
    sortFn?: SortFn;
  }[] = [];

  constructor(private i18nService: I18nService) {}

  // TODO: PM-34091 - Collapse ngOnInit back to a static readonly columnConfig property once the
  // showRecentlyActive flag is removed. The second column should always use "recentlyActiveText"
  // and the "recentlyActive" i18n key. Remove OnInit from implements if no longer needed.
  ngOnInit(): void {
    this.columnConfig = [
      {
        name: "displayName",
        title: this.i18nService.t("device"),
        headerClass: "tw-w-1/3",
        sortable: true,
      },
      {
        name: this.showRecentlyActive ? "recentlyActiveText" : "loginStatus",
        title: this.i18nService.t(this.showRecentlyActive ? "recentlyActive" : "loginStatus"),
        headerClass: "tw-w-1/3",
        sortable: true,
        // recentlyActiveText is a localized display string ("Today", "Yesterday", etc.) so
        // alphabetical sorting is nonsensical. Sort by the underlying date value instead.
        sortFn: this.showRecentlyActive ? recentlyActiveSortFn : undefined,
      },
      {
        name: "firstLogin",
        title: this.i18nService.t("firstLogin"),
        headerClass: "tw-w-1/3",
        sortable: true,
      },
    ];
  }

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
