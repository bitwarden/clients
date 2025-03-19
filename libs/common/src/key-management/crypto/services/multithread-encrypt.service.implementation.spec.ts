import { mock } from "jest-mock-extended";

import { ServerConfig } from "../../../platform/abstractions/config/server-config";
import { CryptoFunctionService } from "../../../platform/abstractions/crypto-function.service";
import { LogService } from "../../../platform/abstractions/log.service";
import { buildSetConfigMessage } from "../types/worker-command.type";

import { EncryptServiceImplementation } from "./encrypt.service.implementation";
import { MultithreadEncryptServiceImplementation } from "./multithread-encrypt.service.implementation";

describe("MultithreadEncryptServiceImplementation", () => {
  const mockCryptoFunctionService = mock<CryptoFunctionService>();
  const mockLogService = mock<LogService>();
  const mockServerConfig = mock<ServerConfig>();

  let sut: MultithreadEncryptServiceImplementation;

  beforeEach(() => {
    jest.clearAllMocks();

    sut = new MultithreadEncryptServiceImplementation(
      mockCryptoFunctionService,
      mockLogService,
      true,
    );
  });

  describe("onServerConfigChange", () => {
    it("updates internal currentServerConfig to new config and calls super", () => {
      const superSpy = jest.spyOn(EncryptServiceImplementation.prototype, "onServerConfigChange");

      sut.onServerConfigChange(mockServerConfig);

      expect(superSpy).toHaveBeenCalledWith(mockServerConfig);
      expect((sut as any).currentServerConfig).toBe(mockServerConfig);
    });

    it("should send config update to worker if worker exists", async () => {
      const mockWorker = mock<Worker>();
      (sut as any).worker = mockWorker;

      sut.onServerConfigChange(mockServerConfig);

      expect(mockWorker.postMessage).toHaveBeenCalledWith(
        buildSetConfigMessage({ newConfig: mockServerConfig }),
      );
    });
  });
});
