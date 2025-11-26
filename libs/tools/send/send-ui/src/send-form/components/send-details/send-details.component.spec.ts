import { DatePreset, isDatePreset, asDatePreset } from "./send-details.component";

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
    });
  });

  it("rejects invalid numbers and non-numeric values", () => {
    const invalid: Array<any> = [5, -1, 0.5, 0, 9999, "never", "foo", null, undefined, {}, []];
    invalid.forEach((v) => {
      expect(isDatePreset(v)).toBe(false);
      expect(asDatePreset(v)).toBeUndefined();
    });
  });
});
