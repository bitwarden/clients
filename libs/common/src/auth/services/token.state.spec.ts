import { KeyDefinition, UserKeyDefinition } from "../../platform/state";

import {
  ACCESS_TOKEN_DISK,
  ACCESS_TOKEN_MEMORY,
  API_KEY_CLIENT_ID_DISK,
  API_KEY_CLIENT_ID_MEMORY,
  API_KEY_CLIENT_SECRET_DISK,
  API_KEY_CLIENT_SECRET_MEMORY,
  EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL,
  REFRESH_TOKEN_DISK,
  REFRESH_TOKEN_MEMORY,
  SECURITY_STAMP_MEMORY,
} from "./token.state";

describe.each([
  [ACCESS_TOKEN_DISK, "accessTokenDisk"],
  [ACCESS_TOKEN_MEMORY, "accessTokenMemory"],
  [REFRESH_TOKEN_DISK, "refreshTokenDisk"],
  [REFRESH_TOKEN_MEMORY, "refreshTokenMemory"],
  [EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL, { user: "token" }],
  [API_KEY_CLIENT_ID_DISK, "apiKeyClientIdDisk"],
  [API_KEY_CLIENT_ID_MEMORY, "apiKeyClientIdMemory"],
  [API_KEY_CLIENT_SECRET_DISK, "apiKeyClientSecretDisk"],
  [API_KEY_CLIENT_SECRET_MEMORY, "apiKeyClientSecretMemory"],
  [SECURITY_STAMP_MEMORY, "securityStamp"],
])(
  "deserializes state key definitions",
  (
    keyDefinition:
      | UserKeyDefinition<string>
      | UserKeyDefinition<boolean>
      | KeyDefinition<Record<string, string>>,
    state: string | boolean | Record<string, string>,
  ) => {
    function getTypeDescription(value: any): string {
      if (isRecord(value)) {
        return "Record<string, string>";
      } else if (Array.isArray(value)) {
        return "array";
      } else if (value === null) {
        return "null";
      }

      // Fallback for primitive types
      return typeof value;
    }

    function isRecord(value: any): value is Record<string, string> {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    }

    function testDeserialization<T>(
      keyDefinition: KeyDefinition<T> | UserKeyDefinition<T>,
      state: T,
    ) {
      const deserialized = keyDefinition.deserializer(JSON.parse(JSON.stringify(state)));
      expect(deserialized).toEqual(state);
    }

    it(`should deserialize state for KeyDefinition<${getTypeDescription(state)}>: "${keyDefinition.key}"`, () => {
      testDeserialization(keyDefinition, state);
    });
  },
);
