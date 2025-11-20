import { isDatePreset, asDatePreset, nameOfDatePreset } from "./add-edit.component";

// Organized by unit: each describe block focuses on a single utility's behavior.
describe("isDatePreset", () => {
  it("returns true for all valid DatePreset values (numbers, 'never', and Custom)", () => {
    const validPresets: Array<any> = [
      1, // OneHour
      24, // OneDay
      48, // TwoDays
      72, // ThreeDays
      168, // SevenDays
      720, // ThirtyDays
      0, // Custom
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
      1, // OneHour
      24, // OneDay
      48, // TwoDays
      72, // ThreeDays
      168, // SevenDays
      720, // ThirtyDays
      0, // Custom
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
    expect(nameOfDatePreset(1)).toBe("OneHour");
    expect(nameOfDatePreset(0)).toBe("Custom");
    expect(nameOfDatePreset("never")).toBe("Never");
  });

  it("returns undefined for invalid inputs", () => {
    const invalidPresets: Array<any> = [5, -1, 999, null, undefined, "foo", {}, []];
    invalidPresets.forEach((preset) => {
      expect(nameOfDatePreset(preset)).toBeUndefined();
    });
  });
});
