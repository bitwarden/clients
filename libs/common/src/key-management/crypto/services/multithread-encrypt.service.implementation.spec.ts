import { mock } from "jest-mock-extended";
import * as rxjs from "rxjs";

import { ServerConfig } from "../../../platform/abstractions/config/server-config";
import { LogService } from "../../../platform/abstractions/log.service";
import { Decryptable } from "../../../platform/interfaces/decryptable.interface";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { CryptoFunctionService } from "../abstractions/crypto-function.service";
import { buildSetConfigMessage } from "../types/worker-command.type";

import { EncryptServiceImplementation } from "./encrypt.service.implementation";
import { MultithreadEncryptServiceImplementation } from "./multithread-encrypt.service.implementation";

describe("MultithreadEncryptServiceImplementation", () => {
  const cryptoFunctionService = mock<CryptoFunctionService>();
  const logService = mock<LogService>();
  const serverConfig = mock<ServerConfig>();

  let sut: MultithreadEncryptServiceImplementation;

  beforeEach(() => {
    sut = new MultithreadEncryptServiceImplementation(cryptoFunctionService, logService, true);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("decryptItems", () => {
    const key = mock<SymmetricCryptoKey>();
    const mockWorker = mock<Worker>();

    beforeEach(() => {
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

    it("returns empty array if items is null", async () => {
      const items = null as unknown as Decryptable<any>[];
      const result = await sut.decryptItems(items, key);
      expect(result).toEqual([]);
    });

    it("returns empty array if items is empty", async () => {
      const result = await sut.decryptItems([], key);
      expect(result).toEqual([]);
    });

    it("creates worker if none exists", async () => {
      // Make sure currentServerConfig is undefined so a SetConfigMessage is not sent.
      (sut as any).currentServerConfig = undefined;

      await sut.decryptItems([mock<Decryptable<any>>(), mock<Decryptable<any>>()], key);

      expect(global.Worker).toHaveBeenCalled();
      expect(mockWorker.postMessage).toHaveBeenCalledTimes(1);
      expect(mockWorker.postMessage).not.toHaveBeenCalledWith(
        buildSetConfigMessage({ newConfig: serverConfig }),
      );
    });

    it("sends a SetConfigMessage to the new worker when there is a current server config", async () => {
      // Populate currentServerConfig so a SetConfigMessage is sent.
      (sut as any).currentServerConfig = serverConfig;

      await sut.decryptItems([mock<Decryptable<any>>(), mock<Decryptable<any>>()], key);

      expect(global.Worker).toHaveBeenCalled();
      expect(mockWorker.postMessage).toHaveBeenCalledTimes(2);
      expect(mockWorker.postMessage).toHaveBeenCalledWith(
        buildSetConfigMessage({ newConfig: serverConfig }),
      );
    });

    it("does not create worker if one exists", async () => {
      (sut as any).currentServerConfig = serverConfig;
      (sut as any).worker = mockWorker;

      await sut.decryptItems([mock<Decryptable<any>>(), mock<Decryptable<any>>()], key);

      expect(global.Worker).not.toHaveBeenCalled();
      expect(mockWorker.postMessage).toHaveBeenCalledTimes(1);
      expect(mockWorker.postMessage).not.toHaveBeenCalledWith(
        buildSetConfigMessage({ newConfig: serverConfig }),
      );
    });
  });

  describe("onServerConfigChange", () => {
    it("updates internal currentServerConfig to new config and calls super", () => {
      const superSpy = jest.spyOn(EncryptServiceImplementation.prototype, "onServerConfigChange");

      sut.onServerConfigChange(serverConfig);

      expect(superSpy).toHaveBeenCalledWith(serverConfig);
      expect((sut as any).currentServerConfig).toBe(serverConfig);
    });

    it("sends config update to worker if worker exists", () => {
      const mockWorker = mock<Worker>();
      (sut as any).worker = mockWorker;

      sut.onServerConfigChange(serverConfig);

      expect(mockWorker.postMessage).toHaveBeenCalledTimes(1);
      expect(mockWorker.postMessage).toHaveBeenCalledWith(
        buildSetConfigMessage({ newConfig: serverConfig }),
      );
    });
  });
});
