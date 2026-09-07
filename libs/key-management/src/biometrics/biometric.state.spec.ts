import { KeyDefinition, UserKeyDefinition } from "@bitwarden/common/platform/state";

import {
  BIOMETRIC_UNLOCK_ENABLED,
  PROMPT_AUTOMATICALLY,
  PROMPT_CANCELLED,
} from "./biometric.state";

describe.each([
  [PROMPT_CANCELLED, { userId1: true, userId2: false }],
  [PROMPT_AUTOMATICALLY, true],
  [BIOMETRIC_UNLOCK_ENABLED, true],
])(
  "deserializes state %s",
  (...args: [UserKeyDefinition<unknown> | KeyDefinition<unknown>, unknown]) => {
    function testDeserialization<T>(
      keyDefinition: UserKeyDefinition<T> | KeyDefinition<T>,
      state: T,
    ) {
      const deserialized = keyDefinition.deserializer(JSON.parse(JSON.stringify(state)));
      expect(deserialized).toEqual(state);
    }

    it("should deserialize state", () => {
      const [keyDefinition, state] = args;
      testDeserialization(keyDefinition, state);
    });
  },
);
