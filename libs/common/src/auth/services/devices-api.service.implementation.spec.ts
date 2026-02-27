import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "../../abstractions/api.service";
import { DeviceResponse } from "../abstractions/devices/responses/device.response";

import { DevicesApiServiceImplementation } from "./devices-api.service.implementation";

describe("DevicesApiServiceImplementation", () => {
  let devicesApiService: DevicesApiServiceImplementation;
  let apiService: MockProxy<ApiService>;

  beforeEach(() => {
    apiService = mock<ApiService>();
    devicesApiService = new DevicesApiServiceImplementation(apiService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("getKnownDevice", () => {
    it("calls api with correct parameters", async () => {
      const email = "test@example.com";
      const deviceIdentifier = "device123";
      apiService.send.mockResolvedValue(true);

      const result = await devicesApiService.getKnownDevice(email, deviceIdentifier);

      expect(result).toBe(true);
      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/devices/knowndevice",
        null,
        false,
        true,
        null,
        expect.any(Function),
      );
    });
  });

  describe("getDeviceByIdentifier", () => {
    it("returns device response", async () => {
      const deviceIdentifier = "device123";
      const mockResponse = { id: "123", name: "Test Device" };
      apiService.send.mockResolvedValue(mockResponse);

      const result = await devicesApiService.getDeviceByIdentifier(deviceIdentifier);

      expect(result).toBeInstanceOf(DeviceResponse);
      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        `/devices/identifier/${deviceIdentifier}`,
        null,
        true,
        true,
      );
    });
  });

  describe("updateTrustedDeviceKeys", () => {
    it("updates device keys and returns device response", async () => {
      const deviceIdentifier = "device123";
      const publicKeyEncrypted = "encryptedPublicKey";
      const userKeyEncrypted = "encryptedUserKey";
      const deviceKeyEncrypted = "encryptedDeviceKey";
      const mockResponse = { id: "123", name: "Test Device" };
      apiService.send.mockResolvedValue(mockResponse);

      const result = await devicesApiService.updateTrustedDeviceKeys(
        deviceIdentifier,
        publicKeyEncrypted,
        userKeyEncrypted,
        deviceKeyEncrypted,
      );

      expect(result).toBeInstanceOf(DeviceResponse);
      expect(apiService.send).toHaveBeenCalledWith(
        "PUT",
        `/devices/${deviceIdentifier}/keys`,
        {
          encryptedPrivateKey: deviceKeyEncrypted,
          encryptedPublicKey: userKeyEncrypted,
          encryptedUserKey: publicKeyEncrypted,
        },
        true,
        true,
      );
    });
  });

  describe("untrustDevices", () => {
    it("calls api with correct parameters", async () => {
      const deviceIds = ["device1", "device2"];
      apiService.send.mockResolvedValue(true);

      await devicesApiService.untrustDevices(deviceIds);
      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/devices/untrust",
        {
          devices: deviceIds,
        },
        true,
        false,
      );
    });
  });

  describe("error handling", () => {
    it("propagates api errors", async () => {
      const error = new Error("API Error");
      apiService.send.mockRejectedValue(error);

      await expect(devicesApiService.getDevices()).rejects.toThrow("API Error");
    });
  });
});
