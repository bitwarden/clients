import { KeyDefinition, StateDefinition } from "@bitwarden/state";

import { lookupOverlay, __resetOverlaysForTests } from "../managed-overlay-registry";

import { booleanLeaf, defineScalarOverlay, enumLeaf, stringLeaf } from "./scalar.overlay";

const TEST_DISK = new StateDefinition("scalarOverlayTest", "disk");

beforeEach(() => {
  __resetOverlaysForTests();
});

describe("scalar overlay parsers", () => {
  it("booleanLeaf accepts a boolean and rejects anything else", () => {
    expect(booleanLeaf(true)).toBe(true);
    expect(booleanLeaf("true")).toBeNull();
    expect(booleanLeaf(1)).toBeNull();
  });

  it("stringLeaf accepts a string and rejects anything else", () => {
    expect(stringLeaf("x")).toBe("x");
    expect(stringLeaf(3)).toBeNull();
  });

  it("enumLeaf accepts a listed value and rejects others", () => {
    const parse = enumLeaf(["light", "dark"]);
    expect(parse("dark")).toBe("dark");
    expect(parse("purple")).toBeNull();
    expect(parse(0)).toBeNull();
  });
});

describe("defineScalarOverlay", () => {
  it("registers an overlay whose coerce parses the managed key", () => {
    const kd = new KeyDefinition<boolean>(TEST_DISK, "flag", { deserializer: (v) => v });
    defineScalarOverlay(kd, "test.flag", booleanLeaf);

    const overlay = lookupOverlay(kd);
    expect(overlay).not.toBeUndefined();
    expect(overlay!.coerce((k) => (k === "test.flag" ? "true" : undefined))).toBe(true);
  });

  it("returns null when the key is absent or malformed", () => {
    const kd = new KeyDefinition<boolean>(TEST_DISK, "flag2", { deserializer: (v) => v });
    defineScalarOverlay(kd, "test.flag2", booleanLeaf);
    const overlay = lookupOverlay(kd)!;

    expect(overlay.coerce(() => undefined)).toBeNull();
    expect(overlay.coerce(() => "not json")).toBeNull();
    expect(overlay.coerce(() => '"a string not a bool"')).toBeNull();
  });
});
