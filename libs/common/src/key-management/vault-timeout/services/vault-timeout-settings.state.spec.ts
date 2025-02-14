import { UserKeyDefinition } from "../../../platform/state";
import { VaultTimeoutAction } from "../enums/vault-timeout-action.enum";
import { VaultTimeout } from "../types/vault-timeout.type";

import { VAULT_TIMEOUT, VAULT_TIMEOUT_ACTION } from "./vault-timeout-settings.state";

describe.each([
  [VAULT_TIMEOUT_ACTION, VaultTimeoutAction.Lock],
  [VAULT_TIMEOUT, 5],
])(
  "deserializes state key definitions",
  (
    keyDefinition: UserKeyDefinition<VaultTimeoutAction> | UserKeyDefinition<VaultTimeout>,
    state: VaultTimeoutAction | VaultTimeout | boolean,
  ) => {
    function getTypeDescription(value: any): string {
      if (Array.isArray(value)) {
        return "array";
      } else if (value === null) {
        return "null";
      }

      // Fallback for primitive types
      return typeof value;
    }

    function testDeserialization<T>(keyDefinition: UserKeyDefinition<T>, state: T) {
      const deserialized = keyDefinition.deserializer(JSON.parse(JSON.stringify(state)));
      expect(deserialized).toEqual(state);
    }

    it(`should deserialize state for KeyDefinition<${getTypeDescription(state)}>: "${keyDefinition.key}"`, () => {
      testDeserialization(keyDefinition, state);
    });
  },
);
