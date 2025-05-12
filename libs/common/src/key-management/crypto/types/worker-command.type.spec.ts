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
    it("builds a message with the correct command", () => {
      const commandData = createDecryptCommandData();

      const result = buildDecryptMessage(commandData);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.command).toBe(DECRYPT_COMMAND);
    });

    it("includes the provided data in the message", () => {
      const mockItems = [{ encrypted: "test-encrypted" } as unknown as Decryptable<any>];
      const commandData = createDecryptCommandData(mockItems);

      const result = buildDecryptMessage(commandData);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.command).toBe(DECRYPT_COMMAND);
      expect(parsedResult.id).toBe("test-id");
      expect(parsedResult.items).toEqual(mockItems);
      expect(SymmetricCryptoKey.fromJSON(parsedResult.key)).toEqual(commandData.key);
    });
  });

  describe("buildSetConfigMessage", () => {
    it("builds a message with the correct command", () => {
      const result = buildSetConfigMessage({ newConfig: mock<ServerConfig>() });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.command).toBe(SET_CONFIG_COMMAND);
    });

    it("includes the provided data in the message", () => {
      const serverConfig = { version: "test-version" } as unknown as ServerConfig;

      const result = buildSetConfigMessage({ newConfig: serverConfig });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.command).toBe(SET_CONFIG_COMMAND);
      expect(ServerConfig.fromJSON(parsedResult.newConfig).version).toEqual(serverConfig.version);
    });
  });
});

function createDecryptCommandData(items?: Decryptable<any>[]): DecryptCommandData {
  return {
    id: "test-id",
    items: items ?? [],
    key: new SymmetricCryptoKey(makeStaticByteArray(64)),
  };
}
