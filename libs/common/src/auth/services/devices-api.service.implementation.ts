// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ApiService } from "../../abstractions/api.service";
import { ListResponse } from "../../models/response/list.response";
import { Utils } from "../../platform/misc/utils";
import { UserId } from "../../types/guid";
import { DeviceResponse } from "../abstractions/devices/responses/device.response";
import { DevicesApiServiceAbstraction } from "../abstractions/devices-api.service.abstraction";
import { UntrustDevicesRequestModel } from "../models/request/untrust-devices.request";
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
   * @param userId - the id of the user to authenticate the request as
   */
  async getDeviceByIdentifier(deviceIdentifier: string, userId: UserId): Promise<DeviceResponse> {
    const r = await this.apiService.send(
      "GET",
      `/devices/identifier/${deviceIdentifier}`,
      null,
      userId,
      true,
    );
    return new DeviceResponse(r);
  }

  async getDevices(userId: UserId): Promise<ListResponse<DeviceResponse>> {
    const r = await this.apiService.send("GET", "/devices", null, userId, true, null);
    return new ListResponse(r, DeviceResponse);
  }

  async updateTrustedDeviceKeys(
    deviceIdentifier: string,
    devicePublicKeyEncryptedUserKey: string,
    userKeyEncryptedDevicePublicKey: string,
    deviceKeyEncryptedDevicePrivateKey: string,
    userId: UserId,
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
      userId,
      true,
    );

    return new DeviceResponse(result);
  }

  async updateTrust(
    updateDevicesTrustRequestModel: UpdateDevicesTrustRequest,
    deviceIdentifier: string,
    userId: UserId,
  ): Promise<void> {
    await this.apiService.send(
      "POST",
      "/devices/update-trust",
      updateDevicesTrustRequestModel,
      userId,
      false,
      null,
      (headers) => {
        headers.set("Device-Identifier", deviceIdentifier);
      },
    );
  }

  async getDeviceKeys(deviceIdentifier: string, userId: UserId): Promise<ProtectedDeviceResponse> {
    const result = await this.apiService.send(
      "POST",
      `/devices/${deviceIdentifier}/retrieve-keys`,
      null,
      userId,
      true,
    );
    return new ProtectedDeviceResponse(result);
  }

  async postDeviceTrustLoss(deviceIdentifier: string, userId: UserId): Promise<void> {
    await this.apiService.send(
      "POST",
      "/devices/lost-trust",
      null,
      userId,
      false,
      null,
      (headers) => {
        headers.set("Device-Identifier", deviceIdentifier);
      },
    );
  }

  async deactivateDevice(deviceId: string, userId: UserId): Promise<void> {
    await this.apiService.send("POST", `/devices/${deviceId}/deactivate`, null, userId, false);
  }

  async untrustDevices(deviceIds: string[], userId: UserId): Promise<void> {
    await this.apiService.send(
      "POST",
      "/devices/untrust",
      new UntrustDevicesRequestModel(deviceIds),
      userId,
      false,
    );
  }
}
