import { CommonModule } from "@angular/common";
import { Component, DestroyRef, OnInit, viewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { firstValueFrom } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { AuthRequestApiServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DevicesServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices/devices.service.abstraction";
import {
  DevicePendingAuthRequest,
  DeviceResponse,
} from "@bitwarden/common/auth/abstractions/devices/responses/device.response";
import { DeviceView } from "@bitwarden/common/auth/abstractions/devices/views/device.view";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { PendingAuthRequestsStateService } from "@bitwarden/common/auth/services/auth-request-answering/pending-auth-requests.state";
import { DeviceType, DeviceTypeMetadata } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { MessageListener } from "@bitwarden/common/platform/messaging";
import { ButtonModule, DialogService, IconModule, PopoverModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { LoginApprovalDialogComponent } from "../login-approval";

import { DeviceManagementComponentServiceAbstraction } from "./device-management-component.service.abstraction";
import { DeviceManagementItemGroupComponent } from "./device-management-item-group.component";
import { DeviceManagementTableComponent } from "./device-management-table.component";
import {
  clearAuthRequestAndSortDevices,
  sortDevices,
  sortDevicesWithActivity,
} from "./utils/device-sort.utils";
import { getDeviceLastActivityDateI18nKey } from "./utils/get-device-last-activity-date-i18n-key.func";

export interface DeviceDisplayData {
  creationDate: string;
  displayName: string;
  firstLogin: Date;
  icon: string;
  id: string;
  identifier: string;
  isCurrentDevice: boolean;
  isTrusted: boolean;
  lastActivityDate: Date | null;
  loginStatus: string;
  pendingAuthRequest: DevicePendingAuthRequest | null;
  recentlyActiveText: string;
}

/**
 * The `DeviceManagementComponent` fetches user devices and passes them down
 * to a child component for display.
 *
 * The specific child component that gets displayed depends on the viewport width:
 * - Medium to Large screens = `bit-table` view
 * - Small screens = `bit-item-group` view
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
    IconModule,
    PopoverModule,
  ],
})
export class DeviceManagementComponent implements OnInit {
  private readonly tableComponent = viewChild(DeviceManagementTableComponent);

  protected devices: DeviceDisplayData[] = [];
  protected initializing = true;
  protected showHeaderInfo = false;
  // TODO: PM-34091 - Remove this property and the configService injection; always show recently active.
  protected showRecentlyActive = false;

  constructor(
    private readonly accountService: AccountService,
    private readonly authRequestApiService: AuthRequestApiServiceAbstraction,
    private readonly configService: ConfigService,
    private readonly destroyRef: DestroyRef,
    private readonly deviceManagementComponentService: DeviceManagementComponentServiceAbstraction,
    private readonly devicesService: DevicesServiceAbstraction,
    private readonly dialogService: DialogService,
    private readonly i18nService: I18nService,
    private readonly messageListener: MessageListener,
    private readonly pendingAuthRequestStateService: PendingAuthRequestsStateService,
    private readonly validationService: ValidationService,
  ) {
    this.showHeaderInfo = this.deviceManagementComponentService.showHeaderInformation();
  }

  async ngOnInit() {
    // TODO: PM-34091 - Remove this flag check; delete the FeatureFlag and ConfigService imports if unused.
    this.showRecentlyActive = await this.configService.getFeatureFlag(
      FeatureFlag.PM4516_DevicesLastActivityDate,
    );
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
    return (
      devices
        .map((device): DeviceDisplayData | null => {
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

          const lastActivityDate = device.lastActivityDate
            ? new Date(device.lastActivityDate)
            : null;

          return {
            creationDate: device.creationDate,
            displayName: this.devicesService.getReadableDeviceTypeName(device.type),
            firstLogin: device.creationDate ? new Date(device.creationDate) : new Date(),
            icon: this.getDeviceIcon(device.type),
            id: device.id || "",
            identifier: device.identifier ?? "",
            isCurrentDevice: this.isCurrentDevice(device, currentDevice),
            isTrusted: device.isTrusted ?? false,
            lastActivityDate,
            loginStatus: this.getLoginStatus(device, currentDevice),
            pendingAuthRequest: device.devicePendingAuthRequest ?? null,
            recentlyActiveText: this.getRecentlyActiveText(lastActivityDate),
          };
        })
        .filter((device) => device !== null)
        // TODO: PM-34091 - Remove the ternary; always use sortDevicesWithActivity. Delete sortDevices import.
        .sort(this.showRecentlyActive ? sortDevicesWithActivity : sortDevices)
    );
  }

  // TODO: Clean up this flow: https://bitwarden.atlassian.net/browse/PM-34129
  private async upsertDeviceWithPendingAuthRequest(authRequestId: string) {
    const authRequestResponse = await this.authRequestApiService.getAuthRequest(authRequestId);
    if (!authRequestResponse) {
      return;
    }

    const upsertDevice: DeviceDisplayData = {
      creationDate: "",
      displayName: this.devicesService.getReadableDeviceTypeName(
        authRequestResponse.requestDeviceTypeValue,
      ),
      firstLogin: new Date(authRequestResponse.creationDate),
      icon: this.getDeviceIcon(authRequestResponse.requestDeviceTypeValue),
      id: "",
      identifier: authRequestResponse.requestDeviceIdentifier,
      isCurrentDevice: false,
      isTrusted: false,
      lastActivityDate: null,
      loginStatus: this.i18nService.t("requestPending"),
      pendingAuthRequest: {
        id: authRequestResponse.id,
        creationDate: authRequestResponse.creationDate,
      },
      recentlyActiveText: "",
    };

    // If the device already exists in the DB, update the device id and first login date
    if (authRequestResponse.requestDeviceIdentifier) {
      const existingDevice = await firstValueFrom(
        this.devicesService.getDeviceByIdentifier$(authRequestResponse.requestDeviceIdentifier),
      );

      if (existingDevice?.id && existingDevice.creationDate) {
        upsertDevice.creationDate = existingDevice.creationDate;
        upsertDevice.firstLogin = new Date(existingDevice.creationDate);
        upsertDevice.id = existingDevice.id;
        upsertDevice.isTrusted = existingDevice?.isTrusted ?? false;

        // TODO: PM-34091 - Remove this flag check; always copy lastActivityDate.
        if (this.showRecentlyActive) {
          const lastActivityDate = existingDevice.lastActivityDate
            ? new Date(existingDevice.lastActivityDate)
            : null;
          upsertDevice.lastActivityDate = lastActivityDate;
          upsertDevice.recentlyActiveText = this.getRecentlyActiveText(lastActivityDate);
        }
      }
    }

    const existingDeviceIndex = this.devices.findIndex(
      (device) => device.identifier === upsertDevice.identifier,
    );

    // TODO: PM-34091 - Remove this flag check; always call resetSort().
    if (this.showRecentlyActive) {
      // Reset any user-applied column sort so the default sort order is reflected
      // after the pending auth request is inserted. This ensures the device
      // with the pending auth request goes to the top of the list, instead of
      // potentially being sorted to the middle or bottom of the list.
      this.tableComponent()?.resetSort();
    }

    if (existingDeviceIndex >= 0) {
      // Update existing device in device list
      this.devices[existingDeviceIndex] = upsertDevice;
      // TODO: PM-34091 - Remove the ternary; always use sortDevicesWithActivity.
      this.devices = [...this.devices].sort(
        this.showRecentlyActive ? sortDevicesWithActivity : sortDevices,
      );
    } else {
      // Add new device to device list
      // TODO: PM-34091 - Remove the ternary; always use sortDevicesWithActivity.
      this.devices = [upsertDevice, ...this.devices].sort(
        this.showRecentlyActive ? sortDevicesWithActivity : sortDevices,
      );
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
    return device.devicePendingAuthRequest != null;
  }

  private getRecentlyActiveText(lastActivityDate: Date | null): string {
    const key = getDeviceLastActivityDateI18nKey(lastActivityDate);
    return key ? this.i18nService.t(key) : "";
  }

  private getDeviceIcon(type: DeviceType): string {
    const defaultIcon = "bwi-desktop";
    const categoryIconMap: Record<string, string> = {
      webApp: "bwi-browser",
      desktop: "bwi-desktop",
      mobile: "bwi-mobile",
      cli: "bwi-cli",
      extension: "bwi-puzzle",
      sdk: "bwi-desktop",
    };

    const metadata = DeviceTypeMetadata[type];
    return metadata ? (categoryIconMap[metadata.category] ?? defaultIcon) : defaultIcon;
  }

  protected async handleAuthRequestAnswered(pendingAuthRequest: DevicePendingAuthRequest) {
    const loginApprovalDialog = LoginApprovalDialogComponent.open(this.dialogService, {
      notificationId: pendingAuthRequest.id,
    });

    const result = await firstValueFrom(loginApprovalDialog.closed);

    if (result !== undefined && typeof result === "boolean") {
      // Auth request was approved or denied, so clear the
      // pending auth request and re-sort the device array
      this.devices = clearAuthRequestAndSortDevices(
        this.devices,
        pendingAuthRequest,
        // TODO: PM-34091 - Remove the ternary; always use sortDevicesWithActivity.
        this.showRecentlyActive ? sortDevicesWithActivity : sortDevices,
      );

      // If a user ignores or doesn't see the auth request dialog, but comes to account settings
      // to approve a device login attempt, clear out the state for that user.
      await this.pendingAuthRequestStateService.clear(
        await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId)),
      );
    }
  }
}
