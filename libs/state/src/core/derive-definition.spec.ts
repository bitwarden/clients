import { DeriveDefinition } from "./derive-definition";
import { KeyDefinition } from "./key-definition";
import { StateDefinition } from "./state-definition";

const derive: () => any = () => null;
const deserializer: any = (obj: any) => obj;

const STATE_DEFINITION = new StateDefinition("test", "disk");
const TEST_KEY = new KeyDefinition(STATE_DEFINITION, "test", {
  deserializer,
});
const TEST_DERIVE = new DeriveDefinition(STATE_DEFINITION, "test", {
  derive,
  deserializer,
});

describe("DeriveDefinition", () => {
  describe("from", () => {
    it("should create a new DeriveDefinition from a KeyDefinition", () => {
      const result = DeriveDefinition.from(TEST_KEY, {
        derive,
        deserializer,
      });

      expect(result).toEqual(TEST_DERIVE);
    });

    it("should create a new DeriveDefinition from a DeriveDefinition", () => {
      const result = DeriveDefinition.from([TEST_DERIVE, "newDerive"], {
        derive,
        deserializer,
      });

      expect(result).toEqual(
        new DeriveDefinition(STATE_DEFINITION, "newDerive", {
          derive,
          deserializer,
        }),
      );
    });
  });
});
