import { mock } from "jest-mock-extended";

import { makeStaticByteArray } from "../../../../spec";
import { ServerConfig } from "../../../platform/abstractions/config/server-config";
import { Decryptable } from "../../../platform/interfaces/decryptable.interface";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";

import {
  DECRYPT_COMMAND,
  DecryptCommandData,
  SET_CONFIG_COMMAND,
  buildDecryptMessage,
  buildSetConfigMessage,
} from "./worker-command.type";

describe("Worker command types", () => {
  describe("buildDecryptMessage", () => {
    it("should build a message with the correct command", () => {
      const mockData = createMockData();
      const result = buildDecryptMessage(mockData);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.command).toBe(DECRYPT_COMMAND);
    });

    it("should include the provided data in the message", () => {
      const mockItems = [{ encrypted: "test-encrypted" } as unknown as Decryptable<any>];
      const mockData = createMockData(mockItems);

      const result = buildDecryptMessage(mockData);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.id).toBe("test-id");
      expect(parsedResult.items).toEqual(mockItems);
      expect(SymmetricCryptoKey.fromJSON(parsedResult.key)).toEqual(mockData.key);
    });
  });

  describe("buildSetConfigMessage", () => {
    it("should build a message with the correct command", () => {
      const result = buildSetConfigMessage({ newConfig: mock<ServerConfig>() });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.command).toBe(SET_CONFIG_COMMAND);
    });

    it("should include the provided data in the message", () => {
      const serverConfig = { version: "test-version" } as unknown as ServerConfig;

      const result = buildSetConfigMessage({ newConfig: serverConfig });
      const parsedResult = JSON.parse(result);

      expect(ServerConfig.fromJSON(parsedResult.newConfig).version).toEqual(serverConfig.version);
    });
  });
});

function createMockData(items?: Decryptable<any>[]): DecryptCommandData {
  return {
    id: "test-id",
    items: items ?? [],
    key: new SymmetricCryptoKey(makeStaticByteArray(64)),
  };
}
