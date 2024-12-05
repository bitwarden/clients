// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SecretVerificationRequest } from "./secret-verification.request";

export class UpdateDevicesTrustRequest extends SecretVerificationRequest {
  currentDevice: DeviceKeysUpdateRequest;
  otherDevices: OtherDeviceKeysUpdateRequest[];
}

export class DeviceKeysUpdateRequest {
  encryptedPublicKey: string;
  encryptedUserKey: string;
}

export class OtherDeviceKeysUpdateRequest extends DeviceKeysUpdateRequest {
  id: string;
}
