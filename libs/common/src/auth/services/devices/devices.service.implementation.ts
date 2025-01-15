import { Observable, defer, map } from "rxjs";

import { ListResponse } from "../../../models/response/list.response";
import { AppIdService } from "../../../platform/abstractions/app-id.service";
import { DevicesServiceAbstraction } from "../../abstractions/devices/devices.service.abstraction";
import { DeviceResponse } from "../../abstractions/devices/responses/device.response";
import { DeviceView } from "../../abstractions/devices/views/device.view";
import { DevicesApiServiceAbstraction } from "../../abstractions/devices-api.service.abstraction";

/**
 * @class DevicesServiceImplementation
 * @implements {DevicesServiceAbstraction}
 * @description Observable based data store service for Devices.
 * note: defer is used to convert the promises to observables and to ensure
 * that observables are created for each subscription
 * (i.e., promsise --> observables are cold until subscribed to)
 */
export class DevicesServiceImplementation implements DevicesServiceAbstraction {
  constructor(
    private devicesApiService: DevicesApiServiceAbstraction,
    private appIdService: AppIdService,
  ) {}

  /**
   * @description Gets the list of all devices.
   */
  getDevices$(): Observable<Array<DeviceView>> {
    return defer(() => this.devicesApiService.getDevices()).pipe(
      map((deviceResponses: ListResponse<DeviceResponse>) => {
        return deviceResponses.data.map((deviceResponse: DeviceResponse) => {
          return new DeviceView(deviceResponse);
        });
      }),
    );
  }

  /**
   * @description Gets the device with the specified identifier.
   */
  getDeviceByIdentifier$(deviceIdentifier: string): Observable<DeviceView> {
    return defer(() => this.devicesApiService.getDeviceByIdentifier(deviceIdentifier)).pipe(
      map((deviceResponse: DeviceResponse) => new DeviceView(deviceResponse)),
    );
  }

  /**
   * @description Checks if a device is known for a user by user's email and device's identifier.
   */
  isDeviceKnownForUser$(email: string, deviceIdentifier: string): Observable<boolean> {
    return defer(() => this.devicesApiService.getKnownDevice(email, deviceIdentifier));
  }

  /**
   * @description Updates the keys for the specified device.
   */

  updateTrustedDeviceKeys$(
    deviceIdentifier: string,
    devicePublicKeyEncryptedUserKey: string,
    userKeyEncryptedDevicePublicKey: string,
    deviceKeyEncryptedDevicePrivateKey: string,
  ): Observable<DeviceView> {
    return defer(() =>
      this.devicesApiService.updateTrustedDeviceKeys(
        deviceIdentifier,
        devicePublicKeyEncryptedUserKey,
        userKeyEncryptedDevicePublicKey,
        deviceKeyEncryptedDevicePrivateKey,
      ),
    ).pipe(map((deviceResponse: DeviceResponse) => new DeviceView(deviceResponse)));
  }

  /**
   * @description Deactivates a device
   */
  deactivateDevice$(deviceId: string): Observable<void> {
    return defer(() => this.devicesApiService.deactivateDevice(deviceId));
  }

  /**
   * @description Gets the current device.
   */
  getCurrentDevice$(): Observable<DeviceResponse> {
    return defer(async () => {
      const deviceIdentifier = await this.appIdService.getAppId();
      return this.devicesApiService.getDeviceByIdentifier(deviceIdentifier);
    });
  }
}
