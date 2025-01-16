import { Observable } from "rxjs";

import { DeviceResponse } from "./responses/device.response";
import { DeviceView } from "./views/device.view";

export abstract class DevicesServiceAbstraction {
  abstract getDevices$(): Observable<Array<DeviceView>>;
  abstract getDeviceByIdentifier$(deviceIdentifier: string): Observable<DeviceView>;
  abstract isDeviceKnownForUser$(email: string, deviceIdentifier: string): Observable<boolean>;
  abstract updateTrustedDeviceKeys$(
    deviceIdentifier: string,
    devicePublicKeyEncryptedUserKey: string,
    userKeyEncryptedDevicePublicKey: string,
    deviceKeyEncryptedDevicePrivateKey: string,
  ): Observable<DeviceView>;
  abstract deactivateDevice$(deviceId: string): Observable<void>;
  abstract getCurrentDevice$(): Observable<DeviceResponse>;
}
