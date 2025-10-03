import { DatePreset, isDatePreset, asDatePreset, nameOfDatePreset } from "./send-details.component";

describe("SendDetails DatePreset utilities", () => {
  it("accepts all defined numeric presets", () => {
    const presets: Array<any> = [
      DatePreset.OneHour,
      DatePreset.OneDay,
      DatePreset.TwoDays,
      DatePreset.ThreeDays,
      DatePreset.SevenDays,
      DatePreset.FourteenDays,
      DatePreset.ThirtyDays,
    ];
    presets.forEach((p) => {
      expect(isDatePreset(p)).toBe(true);
      expect(asDatePreset(p)).toBe(p);
      expect(nameOfDatePreset(p)).toBeDefined();
    });
  });

  it("rejects invalid numbers and non-numeric values", () => {
    const invalid: Array<any> = [5, -1, 0.5, 0, 9999, "never", "foo", null, undefined, {}, []];
    invalid.forEach((v) => {
      expect(isDatePreset(v)).toBe(false);
      expect(asDatePreset(v)).toBeUndefined();
      expect(nameOfDatePreset(v as any)).toBeUndefined();
    });
  });

  it("returns correct names for known presets", () => {
    expect(nameOfDatePreset(DatePreset.OneHour)).toBe("OneHour");
    expect(nameOfDatePreset(DatePreset.ThirtyDays)).toBe("ThirtyDays");
  });
});
