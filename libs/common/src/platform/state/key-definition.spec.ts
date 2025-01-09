import { Opaque } from "type-fest";

import { DebugOptions, KeyDefinition } from "./key-definition";
import { StateDefinition } from "./state-definition";

const fakeStateDefinition = new StateDefinition("fake", "disk");

type FancyString = Opaque<string, "FancyString">;

describe("KeyDefinition", () => {
  describe("constructor", () => {
    it("throws on undefined deserializer", () => {
      expect(() => {
        new KeyDefinition<boolean>(fakeStateDefinition, "fake", {
          deserializer: undefined,
        });
      });
    });

    it("normalizes debug options set to undefined", () => {
      const keyDefinition = new KeyDefinition(fakeStateDefinition, "fake", {
        deserializer: (v) => v,
        debug: undefined,
      });

      expect(keyDefinition.debug.enableUpdateLogging).toBe(false);
    });

    it("normalizes no debug options", () => {
      const keyDefinition = new KeyDefinition(fakeStateDefinition, "fake", {
        deserializer: (v) => v,
      });

      expect(keyDefinition.debug.enableUpdateLogging).toBe(false);
    });

    const cases: {
      debug: DebugOptions | undefined;
      expectedEnableUpdateLogging: boolean;
      expectedEnableRetrievalLogging: boolean;
    }[] = [
      {
        debug: undefined,
        expectedEnableUpdateLogging: false,
        expectedEnableRetrievalLogging: false,
      },
      {
        debug: {},
        expectedEnableUpdateLogging: false,
        expectedEnableRetrievalLogging: false,
      },
      {
        debug: {
          enableUpdateLogging: false,
        },
        expectedEnableUpdateLogging: false,
        expectedEnableRetrievalLogging: false,
      },
      {
        debug: {
          enableRetrievalLogging: false,
        },
        expectedEnableUpdateLogging: false,
        expectedEnableRetrievalLogging: false,
      },
      {
        debug: {
          enableUpdateLogging: true,
        },
        expectedEnableUpdateLogging: true,
        expectedEnableRetrievalLogging: false,
      },
      {
        debug: {
          enableRetrievalLogging: true,
        },
        expectedEnableUpdateLogging: false,
        expectedEnableRetrievalLogging: true,
      },
      {
        debug: {
          enableRetrievalLogging: false,
          enableUpdateLogging: false,
        },
        expectedEnableUpdateLogging: false,
        expectedEnableRetrievalLogging: false,
      },
      {
        debug: {
          enableRetrievalLogging: true,
          enableUpdateLogging: true,
        },
        expectedEnableUpdateLogging: true,
        expectedEnableRetrievalLogging: true,
      },
    ];

    it.each(cases)(
      "normalizes debug options to correct values when given $debug",
      ({ debug, expectedEnableUpdateLogging, expectedEnableRetrievalLogging }) => {
        const keyDefinition = new KeyDefinition(fakeStateDefinition, "fake", {
          deserializer: (v) => v,
          debug: debug,
        });

        expect(keyDefinition.debug.enableUpdateLogging).toBe(expectedEnableUpdateLogging);
        expect(keyDefinition.debug.enableRetrievalLogging).toBe(expectedEnableRetrievalLogging);
      },
    );
  });

  describe("cleanupDelayMs", () => {
    it("defaults to 1000ms", () => {
      const keyDefinition = new KeyDefinition<boolean>(fakeStateDefinition, "fake", {
        deserializer: (value) => value,
      });

      expect(keyDefinition).toBeTruthy();
      expect(keyDefinition.cleanupDelayMs).toBe(1000);
    });

    it("can be overridden", () => {
      const keyDefinition = new KeyDefinition<boolean>(fakeStateDefinition, "fake", {
        deserializer: (value) => value,
        cleanupDelayMs: 500,
      });

      expect(keyDefinition).toBeTruthy();
      expect(keyDefinition.cleanupDelayMs).toBe(500);
    });

    it("throws on negative", () => {
      expect(
        () =>
          new KeyDefinition<boolean>(fakeStateDefinition, "fake", {
            deserializer: (value) => value,
            cleanupDelayMs: -1,
          }),
      ).toThrow();
    });
  });

  describe("record", () => {
    it("runs custom deserializer for each record value", () => {
      const recordDefinition = KeyDefinition.record<boolean>(fakeStateDefinition, "fake", {
        // Intentionally negate the value for testing
        deserializer: (value) => !value,
      });

      expect(recordDefinition).toBeTruthy();
      expect(recordDefinition.deserializer).toBeTruthy();

      const deserializedValue = recordDefinition.deserializer({
        test1: false,
        test2: true,
      });

      expect(Object.keys(deserializedValue)).toHaveLength(2);

      // Values should have swapped from their initial value
      expect(deserializedValue["test1"]).toBeTruthy();
      expect(deserializedValue["test2"]).toBeFalsy();
    });

    it("can handle fancy string type", () => {
      // This test is more of a test that I got the typescript typing correctly than actually testing any business logic
      const recordDefinition = KeyDefinition.record<boolean, FancyString>(
        fakeStateDefinition,
        "fake",
        {
          deserializer: (value) => !value,
        },
      );

      const fancyRecord = recordDefinition.deserializer(
        JSON.parse(`{ "myKey": false, "mySecondKey": true }`),
      );

      expect(fancyRecord).toBeTruthy();
      expect(Object.keys(fancyRecord)).toHaveLength(2);
      expect(fancyRecord["myKey" as FancyString]).toBeTruthy();
      expect(fancyRecord["mySecondKey" as FancyString]).toBeFalsy();
    });
  });

  describe("array", () => {
    it("run custom deserializer for each array element", () => {
      const arrayDefinition = KeyDefinition.array<boolean>(fakeStateDefinition, "fake", {
        deserializer: (value) => !value,
      });

      expect(arrayDefinition).toBeTruthy();
      expect(arrayDefinition.deserializer).toBeTruthy();

      // NOTE: `as any` is here until we migrate to Nx: https://bitwarden.atlassian.net/browse/PM-6493
      const deserializedValue = arrayDefinition.deserializer([false, true] as any);

      expect(deserializedValue).toBeTruthy();
      expect(deserializedValue).toHaveLength(2);
      expect(deserializedValue[0]).toBeTruthy();
      expect(deserializedValue[1]).toBeFalsy();
    });
  });
});
