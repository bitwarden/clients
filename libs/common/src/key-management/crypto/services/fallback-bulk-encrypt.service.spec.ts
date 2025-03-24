import { mock } from "jest-mock-extended";

import { ServerConfig } from "../../../platform/abstractions/config/server-config";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { BulkEncryptService } from "../abstractions/bulk-encrypt.service";
import { EncryptService } from "../abstractions/encrypt.service";

import { FallbackBulkEncryptService } from "./fallback-bulk-encrypt.service";

describe("FallbackBulkEncryptService", () => {
  const encryptService = mock<EncryptService>();
  const featureFlagEncryptService = mock<BulkEncryptService>();
  const serverConfig = mock<ServerConfig>();

  let sut: FallbackBulkEncryptService;

  beforeEach(() => {
    sut = new FallbackBulkEncryptService(encryptService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("decryptItems", () => {
    const key = mock<SymmetricCryptoKey>();
    const mockItems = [{ id: "guid", name: "encryptedValue" }] as any[];
    const mockDecryptedItems = [{ id: "guid", name: "decryptedValue" }] as any[];

    it("calls decryptItems on featureFlagEncryptService when it is set", async () => {
      featureFlagEncryptService.decryptItems.mockResolvedValue(mockDecryptedItems);
      await sut.setFeatureFlagEncryptService(featureFlagEncryptService);

      const result = await sut.decryptItems(mockItems, key);

      expect(featureFlagEncryptService.decryptItems).toHaveBeenCalledWith(mockItems, key);
      expect(encryptService.decryptItems).not.toHaveBeenCalled();
      expect(result).toEqual(mockDecryptedItems);
    });

    it("calls decryptItems on encryptService when featureFlagEncryptService is not set", async () => {
      encryptService.decryptItems.mockResolvedValue(mockDecryptedItems);

      const result = await sut.decryptItems(mockItems, key);

      expect(encryptService.decryptItems).toHaveBeenCalledWith(mockItems, key);
      expect(result).toEqual(mockDecryptedItems);
    });
  });

  describe("setFeatureFlagEncryptService", () => {
    it("sets the featureFlagEncryptService property", async () => {
      await sut.setFeatureFlagEncryptService(featureFlagEncryptService);

      expect((sut as any).featureFlagEncryptService).toBe(featureFlagEncryptService);
    });

    it("does not call onServerConfigChange when currentServerConfig is undefined", async () => {
      await sut.setFeatureFlagEncryptService(featureFlagEncryptService);

      expect(featureFlagEncryptService.onServerConfigChange).not.toHaveBeenCalled();
      expect((sut as any).featureFlagEncryptService).toBe(featureFlagEncryptService);
    });

    it("calls onServerConfigChange with currentServerConfig when it is defined", async () => {
      sut.onServerConfigChange(serverConfig);

      await sut.setFeatureFlagEncryptService(featureFlagEncryptService);

      expect(featureFlagEncryptService.onServerConfigChange).toHaveBeenCalledWith(serverConfig);
      expect((sut as any).featureFlagEncryptService).toBe(featureFlagEncryptService);
    });
  });

  describe("onServerConfigChange", () => {
    it("updates internal currentServerConfig to new config", async () => {
      sut.onServerConfigChange(serverConfig);

      expect((sut as any).currentServerConfig).toBe(serverConfig);
    });

    it("calls onServerConfigChange on featureFlagEncryptService when it is set", async () => {
      await sut.setFeatureFlagEncryptService(featureFlagEncryptService);

      sut.onServerConfigChange(serverConfig);

      expect(featureFlagEncryptService.onServerConfigChange).toHaveBeenCalledWith(serverConfig);
      expect(encryptService.onServerConfigChange).not.toHaveBeenCalled();
    });

    it("calls onServerConfigChange on encryptService when featureFlagEncryptService is not set", () => {
      sut.onServerConfigChange(serverConfig);

      expect(encryptService.onServerConfigChange).toHaveBeenCalledWith(serverConfig);
    });
  });
});
