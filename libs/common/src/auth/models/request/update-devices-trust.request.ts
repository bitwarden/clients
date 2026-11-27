// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export class DeviceKeysUpdateRequest {
  encryptedPublicKey: string | undefined;
  encryptedUserKey: string | undefined;
}

export class OtherDeviceKeysUpdateRequest extends DeviceKeysUpdateRequest {
  deviceId: string;
}
