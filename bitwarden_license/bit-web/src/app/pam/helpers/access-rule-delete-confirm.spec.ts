import { accessRuleDeleteConfirmOptions } from "./access-rule-delete-confirm";

describe("accessRuleDeleteConfirmOptions", () => {
  it("asks the warning question with the rule name as the only placeholder", () => {
    expect(accessRuleDeleteConfirmOptions("Prod database")).toEqual({
      title: { key: "pamAccessRuleDeleteConfirmTitle" },
      content: {
        key: "pamAccessRuleDeleteConfirmContent",
        placeholders: ["Prod database"],
      },
      acceptButtonText: { key: "delete" },
      cancelButtonText: { key: "cancel" },
      type: "danger",
    });
  });
});
