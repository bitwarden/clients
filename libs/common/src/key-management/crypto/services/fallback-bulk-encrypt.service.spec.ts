import { mock } from "jest-mock-extended";

import { ServerConfig } from "../../../platform/abstractions/config/server-config";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { BulkEncryptService } from "../abstractions/bulk-encrypt.service";
import { EncryptService } from "../abstractions/encrypt.service";

import { FallbackBulkEncryptService } from "./fallback-bulk-encrypt.service";

describe("FallbackBulkEncryptService", () => {
  const mockEncryptService = mock<EncryptService>();
  const mockFeatureFlagEncryptService = mock<BulkEncryptService>();
  const mockServerConfig = mock<ServerConfig>();

  let sut: FallbackBulkEncryptService;

  beforeEach(() => {
    jest.clearAllMocks();
    sut = new FallbackBulkEncryptService(mockEncryptService);
  });

  describe("decryptItems", () => {
    const mockItems = [{ id: "guid", name: "encryptedValue" }] as any[];
    const mockKey = mock<SymmetricCryptoKey>();
    const mockDecryptedItems = [{ id: "guid", name: "decryptedValue" }] as any[];

    it("should call decryptItems on featureFlagEncryptService when it is set", async () => {
      mockFeatureFlagEncryptService.decryptItems.mockResolvedValue(mockDecryptedItems);
      await sut.setFeatureFlagEncryptService(mockFeatureFlagEncryptService);

      const result = await sut.decryptItems(mockItems, mockKey);

      expect(mockFeatureFlagEncryptService.decryptItems).toHaveBeenCalledWith(mockItems, mockKey);
      expect(mockEncryptService.decryptItems).not.toHaveBeenCalled();
      expect(result).toEqual(mockDecryptedItems);
    });

    it("should call decryptItems on encryptService when featureFlagEncryptService is not set", async () => {
      mockEncryptService.decryptItems.mockResolvedValue(mockDecryptedItems);

      const result = await sut.decryptItems(mockItems, mockKey);

      expect(mockEncryptService.decryptItems).toHaveBeenCalledWith(mockItems, mockKey);
      expect(result).toEqual(mockDecryptedItems);
    });
  });

  describe("onServerConfigChange", () => {
    it("should call onServerConfigChange on featureFlagEncryptService when it is set", async () => {
      await sut.setFeatureFlagEncryptService(mockFeatureFlagEncryptService);

      sut.onServerConfigChange(mockServerConfig);

      expect(mockFeatureFlagEncryptService.onServerConfigChange).toHaveBeenCalledWith(
        mockServerConfig,
      );
      expect(mockEncryptService.onServerConfigChange).not.toHaveBeenCalled();
    });

    it("should call onServerConfigChange on encryptService when featureFlagEncryptService is not set", () => {
      sut.onServerConfigChange(mockServerConfig);

      expect(mockEncryptService.onServerConfigChange).toHaveBeenCalledWith(mockServerConfig);
    });
  });
});
