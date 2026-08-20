import { accessRuleDeleteConfirmParams } from "./access-rule-delete-confirm";

describe("accessRuleDeleteConfirmParams", () => {
  it("asks the delete question with the rule name as the only placeholder", () => {
    expect(accessRuleDeleteConfirmParams("Prod database")).toEqual({
      title: { key: "pamAccessRuleDeleteConfirmTitle" },
      content: {
        key: "pamAccessRuleDeleteConfirmContent",
        placeholders: ["Prod database"],
      },
      acceptButtonText: { key: "delete" },
      cancelButtonText: { key: "cancel" },
      icon: "bwi-clear",
      iconClass: "tw-text-danger",
      acceptButtonType: "primary",
    });
  });
});
