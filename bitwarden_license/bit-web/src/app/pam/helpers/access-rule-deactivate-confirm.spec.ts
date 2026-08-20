import { accessRuleDeactivateConfirmOptions } from "./access-rule-deactivate-confirm";

describe("accessRuleDeactivateConfirmOptions", () => {
  it("asks the singular question by default", () => {
    expect(accessRuleDeactivateConfirmOptions()).toEqual({
      title: { key: "pamAccessRuleDeactivateConfirmTitle" },
      content: { key: "pamAccessRuleDeactivateConfirmContent" },
      acceptButtonText: { key: "pamAccessRuleDeactivate" },
      cancelButtonText: { key: "cancel" },
      type: "warning",
    });
  });

  // "1 rules will stop applying" is not a sentence, so one rule takes the singular copy from
  // whichever surface asked — the row menu (no argument) and the bulk bar (a count of 1) agree.
  it("asks the singular question for a count of one", () => {
    expect(accessRuleDeactivateConfirmOptions(1)).toEqual(accessRuleDeactivateConfirmOptions());
  });

  it("asks the plural question with the count as the only placeholder", () => {
    expect(accessRuleDeactivateConfirmOptions(3)).toEqual({
      title: { key: "pamAccessRuleBulkDeactivateConfirmTitle" },
      content: {
        key: "pamAccessRuleBulkDeactivateConfirmContent",
        placeholders: ["3"],
      },
      acceptButtonText: { key: "pamAccessRuleBulkDeactivate" },
      cancelButtonText: { key: "cancel" },
      type: "warning",
    });
  });
});
