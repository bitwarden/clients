import { KeyDefinition, StateDefinition } from "@bitwarden/state";

import { defineManagedOverlay, lookupOverlay } from "./managed-overlay-registry";

const TEST_SD = new StateDefinition("managedOverlayTest", "disk");
const TEST_KEY = new KeyDefinition<number>(TEST_SD, "len", { deserializer: (v) => v });

describe("ManagedOverlayRegistry", () => {
  it("returns the overlay registered for a KeyDefinition", () => {
    const overlay = defineManagedOverlay({
      managedKey: "test.len",
      keyDefinition: TEST_KEY,
      coerce: (raw) => JSON.parse(raw) as number,
    });
    expect(lookupOverlay(TEST_KEY)).toBe(overlay);
  });

  it("returns undefined for an unregistered KeyDefinition", () => {
    const other = new KeyDefinition<number>(TEST_SD, "other", { deserializer: (v) => v });
    expect(lookupOverlay(other)).toBeUndefined();
  });
});
