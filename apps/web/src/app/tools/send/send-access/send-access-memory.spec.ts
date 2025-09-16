import { KeyDefinition, SEND_ACCESS_AUTH_MEMORY } from "@bitwarden/common/platform/state";
import { SendAccessResponse } from "@bitwarden/common/tools/send/models/response/send-access.response";

import { SEND_CONTEXT_KEY, SEND_RESPONSE_KEY } from "./send-access-memory";
import { SendContext } from "./types";

describe("send-access-memory", () => {
  describe("SEND_CONTEXT_KEY", () => {
    it("has correct state definition properties", () => {
      expect(SEND_CONTEXT_KEY).toBeInstanceOf(KeyDefinition);
      expect(SEND_CONTEXT_KEY.stateDefinition).toBe(SEND_ACCESS_AUTH_MEMORY);
      expect(SEND_CONTEXT_KEY.key).toBe("sendContext");
    });

    it("deserializes data as-is", () => {
      const testContext: SendContext = { id: "test-id", key: "test-key" };
      const deserializer = SEND_CONTEXT_KEY.deserializer;
      expect(deserializer(testContext)).toBe(testContext);
    });

    it("deserializes null as null", () => {
      const deserializer = SEND_CONTEXT_KEY.deserializer;
      expect(deserializer(null)).toBe(null);
    });
  });

  describe("SEND_RESPONSE_KEY", () => {
    it("has correct state definition properties", () => {
      expect(SEND_RESPONSE_KEY).toBeInstanceOf(KeyDefinition);
      expect(SEND_RESPONSE_KEY.stateDefinition).toBe(SEND_ACCESS_AUTH_MEMORY);
      expect(SEND_RESPONSE_KEY.key).toBe("sendResponse");
    });

    it("deserializes data into SendAccessResponse instance", () => {
      const mockData = { id: "test-id", name: "test-send" } as any;
      const deserializer = SEND_RESPONSE_KEY.deserializer;
      const result = deserializer(mockData);

      expect(result).toBeInstanceOf(SendAccessResponse);
    });

    it.each([
      [null, "null"],
      [undefined, "undefined"],
    ])("deserializes %s as null", (value, _) => {
      const deserializer = SEND_RESPONSE_KEY.deserializer;
      expect(deserializer(value!)).toBe(null);
    });
  });
});
