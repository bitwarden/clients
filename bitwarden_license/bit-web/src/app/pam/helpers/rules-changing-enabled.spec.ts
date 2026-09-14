import { rulesChangingEnabled } from "./rules-changing-enabled";

describe("rulesChangingEnabled", () => {
  const rules = [
    { id: "a", enabled: true },
    { id: "b", enabled: false },
    { id: "c", enabled: true },
  ];

  it("keeps only the rules not already disabled when disabling", () => {
    expect(rulesChangingEnabled(rules, false)).toEqual([
      { id: "a", enabled: true },
      { id: "c", enabled: true },
    ]);
  });

  it("keeps only the rules not already enabled when enabling", () => {
    expect(rulesChangingEnabled(rules, true)).toEqual([{ id: "b", enabled: false }]);
  });

  it("is empty when every rule is already in the target state", () => {
    expect(rulesChangingEnabled([{ id: "b", enabled: false }], false)).toEqual([]);
  });
});
