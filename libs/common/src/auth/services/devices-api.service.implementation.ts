// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ApiService } from "../../abstractions/api.service";
import { ListResponse } from "../../models/response/list.response";
import { Utils } from "../../platform/misc/utils";
import { DeviceResponse } from "../abstractions/devices/responses/device.response";
import { DevicesApiServiceAbstraction } from "../abstractions/devices-api.service.abstraction";
import { SecretVerificationRequest } from "../models/request/secret-verification.request";
import { UpdateDevicesTrustRequest } from "../models/request/update-devices-trust.request";
import { ProtectedDeviceResponse } from "../models/response/protected-device.response";

import { TrustedDeviceKeysRequest } from "./devices/requests/trusted-device-keys.request";

export class DevicesApiServiceImplementation implements DevicesApiServiceAbstraction {
  constructor(private apiService: ApiService) {}

  async getKnownDevice(email: string, deviceIdentifier: string): Promise<boolean> {
    const r = await this.apiService.send(
      "GET",
      "/devices/knowndevice",
      null,
      false,
      true,
      null,
      (headers) => {
        headers.set("X-Device-Identifier", deviceIdentifier);
        headers.set("X-Request-Email", Utils.fromUtf8ToUrlB64(email));
      },
    );
    return r as boolean;
  }

  /**
   * Get device by identifier
   * @param deviceIdentifier - client generated id (not device id in DB)
   */
  async getDeviceByIdentifier(deviceIdentifier: string): Promise<DeviceResponse> {
    const r = await this.apiService.send(
      "GET",
      `/devices/identifier/${deviceIdentifier}`,
      null,
      true,
      true,
    );
    return new DeviceResponse(r);
  }

  async getDevices(): Promise<ListResponse<DeviceResponse>> {
    const r = await this.apiService.send("GET", "/devices", null, true, true, null);
    return new ListResponse(r, DeviceResponse);
  }

  async updateTrustedDeviceKeys(
    deviceIdentifier: string,
    devicePublicKeyEncryptedUserKey: string,
    userKeyEncryptedDevicePublicKey: string,
    deviceKeyEncryptedDevicePrivateKey: string,
  ): Promise<DeviceResponse> {
    const request = new TrustedDeviceKeysRequest(
      devicePublicKeyEncryptedUserKey,
      userKeyEncryptedDevicePublicKey,
      deviceKeyEncryptedDevicePrivateKey,
    );

    const result = await this.apiService.send(
      "PUT",
      `/devices/${deviceIdentifier}/keys`,
      request,
      true,
      true,
    );

    return new DeviceResponse(result);
  }

  async updateTrust(
    updateDevicesTrustRequestModel: UpdateDevicesTrustRequest,
    deviceIdentifier: string,
  ): Promise<void> {
    await this.apiService.send(
      "POST",
      "/devices/update-trust",
      updateDevicesTrustRequestModel,
      true,
      false,
      null,
      (headers) => {
        headers.set("Device-Identifier", deviceIdentifier);
      },
    );
  }

  async getDeviceKeys(
    deviceIdentifier: string,
    secretVerificationRequest: SecretVerificationRequest,
  ): Promise<ProtectedDeviceResponse> {
    const result = await this.apiService.send(
      "POST",
      `/devices/${deviceIdentifier}/retrieve-keys`,
      secretVerificationRequest,
      true,
      true,
    );
    return new ProtectedDeviceResponse(result);
  }

  async postDeviceTrustLoss(deviceIdentifier: string): Promise<void> {
    await this.apiService.send(
      "POST",
      "/devices/lost-trust",
      null,
      true,
      false,
      null,
      (headers) => {
        headers.set("Device-Identifier", deviceIdentifier);
      },
    );
  }

  async deactivateDevice(deviceId: string): Promise<void> {
    await this.apiService.send("POST", `/devices/${deviceId}/deactivate`, null, true, false);
  }
}
