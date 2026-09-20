import { Observable } from "rxjs";

import { DeviceType } from "../../../enums";
import { UserId } from "../../../types/guid";

import { DeviceResponse } from "./responses/device.response";
import { DeviceView } from "./views/device.view";

export abstract class DevicesServiceAbstraction {
  abstract getDevices$(userId: UserId): Observable<Array<DeviceView>>;
  abstract getDeviceByIdentifier$(
    deviceIdentifier: string,
    userId: UserId,
  ): Observable<DeviceView>;
  abstract isDeviceKnownForUser$(email: string, deviceIdentifier: string): Observable<boolean>;
  abstract updateTrustedDeviceKeys$(
    deviceIdentifier: string,
    devicePublicKeyEncryptedUserKey: string,
    userKeyEncryptedDevicePublicKey: string,
    deviceKeyEncryptedDevicePrivateKey: string,
    userId: UserId,
  ): Observable<DeviceView>;
  abstract deactivateDevice$(deviceId: string, userId: UserId): Observable<void>;
  abstract getCurrentDevice$(userId: UserId): Observable<DeviceResponse>;
  abstract getReadableDeviceTypeName(deviceType: DeviceType): string;
}
