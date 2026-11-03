import { RiskCategory, isRiskCategory } from "./risk-category";

describe("isRiskCategory", () => {
  it.each(Object.values(RiskCategory))("accepts %s", (category) => {
    expect(isRiskCategory(category)).toBe(true);
  });

  it.each([
    ["an unknown category", "breached"],
    ["a member name rather than its value", "Exposed"],
    ["the wrong case", "EXPOSED"],
    ["an empty string", ""],
  ])("rejects %s", (_label, value) => {
    expect(isRiskCategory(value)).toBe(false);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a number", 1],
    ["an object", {}],
  ])("rejects %s", (_label, value) => {
    expect(isRiskCategory(value)).toBe(false);
  });

  it("narrows the type so a validated route parameter can index the report", () => {
    const fromRoute: string | undefined = "weak";

    expect(isRiskCategory(fromRoute)).toBe(true);
    if (isRiskCategory(fromRoute)) {
      // Compiles only because the guard narrowed `string | undefined` to RiskCategory.
      const category: RiskCategory = fromRoute;
      expect(category).toBe(RiskCategory.Weak);
    }
  });
});
