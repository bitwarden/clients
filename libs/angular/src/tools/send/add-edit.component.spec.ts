import { DatePreset, isDatePreset, asDatePreset, nameOfDatePreset } from "./add-edit.component";

// Organized by unit: each describe block focuses on a single utility's behavior.
describe("isDatePreset", () => {
  it("returns true for all valid DatePreset values (numbers, 'never', and Custom)", () => {
    const validPresets: Array<any> = [
      DatePreset.OneHour,
      DatePreset.OneDay,
      DatePreset.TwoDays,
      DatePreset.ThreeDays,
      DatePreset.SevenDays,
      DatePreset.ThirtyDays,
      DatePreset.Custom,
      "never",
    ];
    validPresets.forEach((preset) => {
      expect(isDatePreset(preset)).toBe(true);
    });
  });

  it("returns false for invalid values", () => {
    const invalidPresets: Array<any> = [5, -1, 999, null, undefined, "foo", {}, []];
    invalidPresets.forEach((preset) => {
      expect(isDatePreset(preset)).toBe(false);
    });
  });
});

describe("asDatePreset", () => {
  it("returns the same value for valid DatePreset inputs", () => {
    const validPresets: Array<any> = [
      DatePreset.OneHour,
      DatePreset.OneDay,
      DatePreset.TwoDays,
      DatePreset.ThreeDays,
      DatePreset.SevenDays,
      DatePreset.ThirtyDays,
      DatePreset.Custom,
      "never",
    ];
    validPresets.forEach((preset) => {
      expect(asDatePreset(preset)).toBe(preset);
    });
  });

  it("returns undefined for invalid inputs", () => {
    const invalidPresets: Array<any> = [5, -1, 999, null, undefined, "foo", {}, []];
    invalidPresets.forEach((preset) => {
      expect(asDatePreset(preset)).toBeUndefined();
    });
  });
});

describe("nameOfDatePreset", () => {
  it("returns the correct key for valid DatePreset values", () => {
    expect(nameOfDatePreset(DatePreset.OneHour)).toBe("OneHour");
    expect(nameOfDatePreset(DatePreset.Custom)).toBe("Custom");
    expect(nameOfDatePreset("never")).toBe("Never");
  });

  it("returns undefined for invalid inputs", () => {
    const invalidPresets: Array<any> = [5, -1, 999, null, undefined, "foo", {}, []];
    invalidPresets.forEach((preset) => {
      expect(nameOfDatePreset(preset)).toBeUndefined();
    });
  });
});
