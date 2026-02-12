import { CommonModule } from "@angular/common";
import { Component, DestroyRef, OnInit } from "@angular/core";
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
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { MessageListener } from "@bitwarden/common/platform/messaging";
import { ButtonModule, DialogService, PopoverModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { LoginApprovalDialogComponent } from "../login-approval";

import { DeviceManagementComponentServiceAbstraction } from "./device-management-component.service.abstraction";
import { DeviceManagementItemGroupComponent } from "./device-management-item-group.component";
import { DeviceManagementTableComponent } from "./device-management-table.component";
import { clearAuthRequestAndResortDevices, resortDevices } from "./resort-devices.helper";

export interface DeviceDisplayData {
  creationDate: string;
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
    PopoverModule,
  ],
})
export class DeviceManagementComponent implements OnInit {
  protected devices: DeviceDisplayData[] = [];
  protected initializing = true;
  protected showHeaderInfo = false;

  constructor(
    private readonly accountService: AccountService,
    private readonly authRequestApiService: AuthRequestApiServiceAbstraction,
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

        return {
          creationDate: device.creationDate,
          displayName: this.devicesService.getReadableDeviceTypeName(device.type),
          firstLogin: device.creationDate ? new Date(device.creationDate) : new Date(),
          icon: this.getDeviceIcon(device.type),
          id: device.id || "",
          identifier: device.identifier ?? "",
          isCurrentDevice: this.isCurrentDevice(device, currentDevice),
          isTrusted: device.response?.isTrusted ?? false,
          loginStatus: this.getLoginStatus(device, currentDevice),
          pendingAuthRequest: device.response?.devicePendingAuthRequest ?? null,
        };
      })
      .filter((device) => device !== null)
      .sort(resortDevices);
  }

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
        upsertDevice.creationDate = existingDevice.creationDate;
        upsertDevice.firstLogin = new Date(existingDevice.creationDate);
        upsertDevice.id = existingDevice.id;
      }
    }

    const existingDeviceIndex = this.devices.findIndex(
      (device) => device.identifier === upsertDevice.identifier,
    );

    if (existingDeviceIndex >= 0) {
      // Update existing device in device list
      this.devices[existingDeviceIndex] = upsertDevice;
      this.devices = [...this.devices].sort(resortDevices);
    } else {
      // Add new device to device list
      this.devices = [upsertDevice, ...this.devices].sort(resortDevices);
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
      webApp: "bwi bwi-browser",
      desktop: "bwi bwi-desktop",
      mobile: "bwi bwi-mobile",
      cli: "bwi bwi-cli",
      extension: "bwi bwi-puzzle",
      sdk: "bwi bwi-desktop",
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
      this.devices = clearAuthRequestAndResortDevices(this.devices, pendingAuthRequest);

      // If a user ignores or doesn't see the auth request dialog, but comes to account settings
      // to approve a device login attempt, clear out the state for that user.
      await this.pendingAuthRequestStateService.clear(
        await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId)),
      );
    }
  }
}
