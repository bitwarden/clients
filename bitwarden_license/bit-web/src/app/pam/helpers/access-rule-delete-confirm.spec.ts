import { accessRuleDeleteConfirmOptions } from "./access-rule-delete-confirm";

describe("accessRuleDeleteConfirmOptions", () => {
  it("asks the delete question with no placeholders", () => {
    expect(accessRuleDeleteConfirmOptions()).toEqual({
      title: { key: "pamAccessRuleDeleteConfirmTitle" },
      content: { key: "pamAccessRuleDeleteConfirmDescription" },
      acceptButtonText: { key: "delete" },
      cancelButtonText: { key: "cancel" },
      type: "danger",
    });
  });
});
