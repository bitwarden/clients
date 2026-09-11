import { discardConfirmOptions } from "./discard-confirm";

describe("discardConfirmOptions", () => {
  it("names the record being abandoned while creating", () => {
    expect(
      discardConfirmOptions({ editing: false, createTitleKey: "pamTargetSystemDiscardTitle" }),
    ).toEqual({
      title: { key: "pamTargetSystemDiscardTitle" },
      content: { key: "pamAccessRuleDiscardContent" },
      acceptButtonText: { key: "pamAccessRuleDiscardConfirm" },
      cancelButtonText: { key: "cancel" },
      type: "warning",
    });
  });

  it("asks about the edits, not the record, while editing", () => {
    expect(
      discardConfirmOptions({ editing: true, createTitleKey: "pamTargetSystemDiscardTitle" }),
    ).toEqual({
      title: { key: "discardEditsTitle" },
      content: { key: "discardEditsConfirmation" },
      acceptButtonText: { key: "discardEdits" },
      cancelButtonText: { key: "keepEditing" },
      type: "warning",
    });
  });
});
