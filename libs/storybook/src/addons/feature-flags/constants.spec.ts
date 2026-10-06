import { FEATURE_FLAGS_GLOBAL, featureFlagModes } from "./constants";

describe("featureFlagModes", () => {
  it("builds off and on Chromatic modes for the given flags", () => {
    const modes = featureFlagModes("flag-a", "flag-b");

    expect(modes["flag off"]).toEqual({ [FEATURE_FLAGS_GLOBAL]: [] });
    expect(modes["flag on"]).toEqual({ [FEATURE_FLAGS_GLOBAL]: ["flag-a", "flag-b"] });
  });
});
