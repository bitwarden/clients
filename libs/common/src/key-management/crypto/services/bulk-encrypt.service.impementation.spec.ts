import { mock, MockProxy } from "jest-mock-extended";

import { ServerConfig } from "../../../platform/abstractions/config/server-config";
import { CryptoFunctionService } from "../../../platform/abstractions/crypto-function.service";
import { LogService } from "../../../platform/abstractions/log.service";
import { Decryptable } from "../../../platform/interfaces/decryptable.interface";
import { InitializerMetadata } from "../../../platform/interfaces/initializer-metadata.interface";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { buildSetConfigMessage } from "../types/worker-command.type";

import { BulkEncryptServiceImplementation } from "./bulk-encrypt.service.implementation";

describe("BulkEncryptServiceImplementation", () => {
  const cryptoFunctionService = mock<CryptoFunctionService>();
  const logService = mock<LogService>();
  const mockKey = mock<SymmetricCryptoKey>();

  let sut: BulkEncryptServiceImplementation;

  beforeEach(() => {
    jest.clearAllMocks();

    sut = new BulkEncryptServiceImplementation(cryptoFunctionService, logService);
  });

  describe("decryptItems", () => {
    let key: MockProxy<SymmetricCryptoKey>;
    let mockWindow: any;

    beforeEach(() => {
      key = mock<SymmetricCryptoKey>();
      mockWindow = global.window;
    });

    afterEach(() => {
      global.window = mockWindow;
    });

    it("throws error if key is null", async () => {
      const nullKey = null as unknown as SymmetricCryptoKey;
      await expect(sut.decryptItems([], nullKey)).rejects.toThrow("No encryption key provided.");
    });

    it("returns an empty array when items is null", async () => {
      const result = await sut.decryptItems(null as any, mockKey);
      expect(result).toEqual([]);
    });

    it("returns an empty array when items is empty", async () => {
      const result = await sut.decryptItems([], mockKey);
      expect(result).toEqual([]);
    });

    it("decrypts items sequentially when window is undefined", async () => {
      // Mock window as undefined
      delete (global as any).window;

      const mockItems = [createMockDecryptable("item1"), createMockDecryptable("item2")];

      const result = await sut.decryptItems(mockItems, key);

      expect(logService.info).toHaveBeenCalledWith(
        "Window not available in BulkEncryptService, decrypting sequentially",
      );
      expect(result).toEqual(["item1", "item2"]);
      expect(mockItems[0].decrypt).toHaveBeenCalledWith(key);
      expect(mockItems[1].decrypt).toHaveBeenCalledWith(key);
    });

    it("uses workers for decryption when window is available", async () => {
      // Mock the private method
      const mockDecryptedItems = ["decrypted1", "decrypted2"];
      jest
        .spyOn<any, any>(sut, "getDecryptedItemsFromWorkers")
        .mockResolvedValue(mockDecryptedItems);

      const mockItems = [createMockDecryptable("item1"), createMockDecryptable("item2")];

      const result = await sut.decryptItems(mockItems, key);

      expect(sut["getDecryptedItemsFromWorkers"]).toHaveBeenCalledWith(mockItems, key);
      expect(result).toEqual(mockDecryptedItems);
    });
  });

  describe("onServerConfigChange", () => {
    it("updates internal currentServerConfig to new config", () => {
      const newConfig = mock<ServerConfig>();

      sut.onServerConfigChange(newConfig);

      expect((sut as any).currentServerConfig).toBe(newConfig);
    });

    it("does send a SetConfigMessage to workers when there is a worker", () => {
      const newConfig = mock<ServerConfig>();
      const mockWorker = mock<Worker>();
      (sut as any).workers = [mockWorker];

      sut.onServerConfigChange(newConfig);

      expect(mockWorker.postMessage).toHaveBeenCalledWith(buildSetConfigMessage({ newConfig }));
    });
  });
});

function createMockDecryptable<T extends InitializerMetadata>(
  returnValue: any,
): MockProxy<Decryptable<T>> {
  const mockDecryptable = mock<Decryptable<T>>();
  mockDecryptable.decrypt.mockResolvedValue(returnValue);
  return mockDecryptable;
}
