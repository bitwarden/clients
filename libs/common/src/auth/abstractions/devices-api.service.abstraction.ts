import { DeviceResponse } from "../../abstractions/devices/responses/device.response";
import { ListResponse } from "../../models/response/list.response";
import { SecretVerificationRequest } from "../models/request/secret-verification.request";
import { UpdateDevicesTrustRequest } from "../models/request/update-devices-trust.request";
import { ProtectedDeviceResponse } from "../models/response/protected-device.response";

export abstract class DevicesApiServiceAbstraction {
  getKnownDevice: (email: string, deviceIdentifier: string) => Promise<boolean>;

  getDeviceByIdentifier: (deviceIdentifier: string) => Promise<DeviceResponse>;

  getDevices: () => Promise<ListResponse<DeviceResponse>>;

  updateTrustedDeviceKeys: (
    deviceIdentifier: string,
    devicePublicKeyEncryptedUserKey: string,
    userKeyEncryptedDevicePublicKey: string,
    deviceKeyEncryptedDevicePrivateKey: string
  ) => Promise<DeviceResponse>;

  updateTrust: (updateDevicesTrustRequestModel: UpdateDevicesTrustRequest) => Promise<void>;

  getDeviceKeys: (
    deviceIdentifier: string,
    secretVerificationRequest: SecretVerificationRequest
  ) => Promise<ProtectedDeviceResponse>;
}
