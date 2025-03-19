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
    jest.clearAllMocks();
    sut = new FallbackBulkEncryptService(encryptService);
  });

  describe("decryptItems", () => {
    const mockItems = [{ id: "guid", name: "encryptedValue" }] as any[];
    const key = mock<SymmetricCryptoKey>();
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

  describe("onServerConfigChange", () => {
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
