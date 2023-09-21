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
