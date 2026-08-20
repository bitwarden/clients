import { FEATURE_FLAGS_GLOBAL, featureFlagModes, featureFlagModesAtWidth } from "./constants";

describe("featureFlagModes", () => {
  it("builds off and on Chromatic modes for the given flags", () => {
    const modes = featureFlagModes("flag-a", "flag-b");

    expect(modes["flag off"]).toEqual({ [FEATURE_FLAGS_GLOBAL]: [] });
    expect(modes["flag on"]).toEqual({ [FEATURE_FLAGS_GLOBAL]: ["flag-a", "flag-b"] });
  });
});

describe("featureFlagModesAtWidth", () => {
  it("pins every mode to the given width", () => {
    const modes = featureFlagModesAtWidth(400, "flag-a");

    expect(modes["flag off"]).toEqual({ [FEATURE_FLAGS_GLOBAL]: [], viewport: { width: 400 } });
    expect(modes["flag on"]).toEqual({
      [FEATURE_FLAGS_GLOBAL]: ["flag-a"],
      viewport: { width: 400 },
    });
  });
});
