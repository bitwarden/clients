import { DefaultFeatureFlagValue, FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { BOOLEAN_FEATURE_FLAGS } from "./feature-flag-catalog";

describe("BOOLEAN_FEATURE_FLAGS", () => {
  it("includes every boolean flag", () => {
    const expected = Object.values(FeatureFlag).filter(
      (flag) => typeof DefaultFeatureFlagValue[flag] === "boolean",
    );

    expect(BOOLEAN_FEATURE_FLAGS.map((f) => f.value).sort()).toEqual(expected.sort());
  });

  it("excludes flags that on/off/default cannot express", () => {
    const nonBoolean = BOOLEAN_FEATURE_FLAGS.filter(
      ({ value }) => typeof DefaultFeatureFlagValue[value] !== "boolean",
    );

    expect(nonBoolean).toEqual([]);
  });

  it("is sorted by enum member name", () => {
    const names = BOOLEAN_FEATURE_FLAGS.map((f) => f.name);

    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("pairs each enum member name with its wire value", () => {
    for (const { name, value } of BOOLEAN_FEATURE_FLAGS) {
      expect(FeatureFlag[name as keyof typeof FeatureFlag]).toBe(value);
    }
  });
});
