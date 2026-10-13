import { filterRulesToToggle } from "./filter-rules-to-toggle";

describe("filterRulesToToggle", () => {
  const rules = [
    { id: "a", enabled: true },
    { id: "b", enabled: false },
    { id: "c", enabled: true },
  ];

  it("keeps only the rules not already disabled when disabling", () => {
    expect(filterRulesToToggle(rules, false)).toEqual([
      { id: "a", enabled: true },
      { id: "c", enabled: true },
    ]);
  });

  it("keeps only the rules not already enabled when enabling", () => {
    expect(filterRulesToToggle(rules, true)).toEqual([{ id: "b", enabled: false }]);
  });

  it("is empty when every rule is already in the target state", () => {
    expect(filterRulesToToggle([{ id: "b", enabled: false }], false)).toEqual([]);
  });
});
