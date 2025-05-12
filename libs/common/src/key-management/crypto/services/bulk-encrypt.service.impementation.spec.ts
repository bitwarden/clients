import { mock, MockProxy } from "jest-mock-extended";
import * as rxjs from "rxjs";

import { ServerConfig } from "../../../platform/abstractions/config/server-config";
import { LogService } from "../../../platform/abstractions/log.service";
import { Decryptable } from "../../../platform/interfaces/decryptable.interface";
import { InitializerMetadata } from "../../../platform/interfaces/initializer-metadata.interface";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { CryptoFunctionService } from "../abstractions/crypto-function.service";
import { buildSetConfigMessage } from "../types/worker-command.type";

import { BulkEncryptServiceImplementation } from "./bulk-encrypt.service.implementation";

describe("BulkEncryptServiceImplementation", () => {
  const cryptoFunctionService = mock<CryptoFunctionService>();
  const logService = mock<LogService>();

  let sut: BulkEncryptServiceImplementation;

  beforeEach(() => {
    sut = new BulkEncryptServiceImplementation(cryptoFunctionService, logService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("decryptItems", () => {
    const key = mock<SymmetricCryptoKey>();
    const serverConfig = mock<ServerConfig>();
    const mockWorker = mock<Worker>();
    let globalWindow: any;

    beforeEach(() => {
      globalWindow = global.window;

      // Mock creating a worker.
      global.Worker = jest.fn().mockImplementation(() => mockWorker);
      global.URL = jest.fn().mockImplementation(() => "url") as unknown as typeof URL;
      global.URL.createObjectURL = jest.fn().mockReturnValue("blob:url");
      global.URL.revokeObjectURL = jest.fn();
      global.URL.canParse = jest.fn().mockReturnValue(true);

      // Mock the workers returned response.
      const mockMessageEvent = {
        id: "mock-guid",
        data: ["decrypted1", "decrypted2"],
      };
      const mockMessageEvent$ = rxjs.from([mockMessageEvent]);
      jest.spyOn(rxjs, "fromEvent").mockReturnValue(mockMessageEvent$);
    });

    afterEach(() => {
      global.window = globalWindow;
    });

    it("throws error if key is null", async () => {
      const nullKey = null as unknown as SymmetricCryptoKey;
      await expect(sut.decryptItems([], nullKey)).rejects.toThrow("No encryption key provided.");
    });

    it("returns an empty array when items is null", async () => {
      const result = await sut.decryptItems(null as any, key);
      expect(result).toEqual([]);
    });

    it("returns an empty array when items is empty", async () => {
      const result = await sut.decryptItems([], key);
      expect(result).toEqual([]);
    });

    it("decrypts items sequentially when window is undefined", async () => {
      // Make global window undefined.
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
      const mockDecryptedItems = ["decrypted1", "decrypted2"];
      jest
        .spyOn<any, any>(sut, "getDecryptedItemsFromWorkers")
        .mockResolvedValue(mockDecryptedItems);

      const mockItems = [createMockDecryptable("item1"), createMockDecryptable("item2")];

      const result = await sut.decryptItems(mockItems, key);

      expect(sut["getDecryptedItemsFromWorkers"]).toHaveBeenCalledWith(mockItems, key);
      expect(result).toEqual(mockDecryptedItems);
    });

    it("creates new worker when none exist", async () => {
      (sut as any).currentServerConfig = undefined;
      const mockItems = [createMockDecryptable("item1"), createMockDecryptable("item2")];

      await sut.decryptItems(mockItems, key);

      expect(global.Worker).toHaveBeenCalled();
      expect(mockWorker.postMessage).toHaveBeenCalledTimes(1);
      expect(mockWorker.postMessage).not.toHaveBeenCalledWith(
        buildSetConfigMessage({ newConfig: serverConfig }),
      );
    });

    it("sends a SetConfigMessage to the new worker when there is a current server config", async () => {
      (sut as any).currentServerConfig = serverConfig;
      const mockItems = [createMockDecryptable("item1"), createMockDecryptable("item2")];

      await sut.decryptItems(mockItems, key);

      expect(global.Worker).toHaveBeenCalled();
      expect(mockWorker.postMessage).toHaveBeenCalledTimes(2);
      expect(mockWorker.postMessage).toHaveBeenCalledWith(
        buildSetConfigMessage({ newConfig: serverConfig }),
      );
    });

    it("does not create worker if one exists", async () => {
      (sut as any).currentServerConfig = serverConfig;
      (sut as any).workers = [mockWorker];
      const mockItems = [createMockDecryptable("item1"), createMockDecryptable("item2")];

      await sut.decryptItems(mockItems, key);

      expect(global.Worker).not.toHaveBeenCalled();
      expect(mockWorker.postMessage).toHaveBeenCalledTimes(1);
      expect(mockWorker.postMessage).not.toHaveBeenCalledWith(
        buildSetConfigMessage({ newConfig: serverConfig }),
      );
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
