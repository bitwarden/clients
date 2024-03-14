import { calculateToastTimeout } from "./utils";

describe("Toast default timer", () => {
  it("should have a minimum of 5000ms", () => {
    expect(calculateToastTimeout("")).toBe(5000);
    expect(calculateToastTimeout([""])).toBe(5000);
    expect(calculateToastTimeout(" ")).toBe(5000);
  });

  it("should return an extra second for each 120 words", () => {
    expect(calculateToastTimeout("foo ".repeat(119))).toBe(5000);
    expect(calculateToastTimeout("foo ".repeat(120))).toBe(6000);
    expect(calculateToastTimeout("foo ".repeat(240))).toBe(7000);
    expect(calculateToastTimeout(["foo ".repeat(120), " \n foo ".repeat(120)])).toBe(7000);
  });
});
