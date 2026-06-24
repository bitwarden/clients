import { KeyDefinition, StateDefinition } from "@bitwarden/state";

import {
  __resetOverlaysForTests,
  defineManagedOverlay,
  lookupOverlay,
  registeredOverlays,
} from "./managed-overlay-registry";

const TEST_SD = new StateDefinition("managedOverlayTest", "disk");
const TEST_KEY = new KeyDefinition<number>(TEST_SD, "len", { deserializer: (v) => v });

describe("ManagedOverlayRegistry", () => {
  beforeEach(() => __resetOverlaysForTests());

  it("returns the overlay registered for a KeyDefinition", () => {
    const overlay = defineManagedOverlay({
      keyDefinition: TEST_KEY,
      coerce: (get) => {
        const raw = get("test.len");
        return raw == null ? null : (JSON.parse(raw) as number);
      },
    });
    expect(lookupOverlay(TEST_KEY)).toBe(overlay);
    expect(registeredOverlays()).toContain(overlay);
  });

  it("returns undefined for an unregistered KeyDefinition", () => {
    const other = new KeyDefinition<number>(TEST_SD, "other", { deserializer: (v) => v });
    expect(lookupOverlay(other)).toBeUndefined();
  });

  it("is idempotent per keyDefinition", () => {
    const first = defineManagedOverlay({ keyDefinition: TEST_KEY, coerce: () => 1 });
    const second = defineManagedOverlay({ keyDefinition: TEST_KEY, coerce: () => 2 });
    expect(second).toBe(first);
    expect(registeredOverlays().filter((o) => o.keyDefinition === TEST_KEY)).toHaveLength(1);
  });
});
