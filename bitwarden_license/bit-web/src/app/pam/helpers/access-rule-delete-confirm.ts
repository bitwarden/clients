import { SimpleDialogOptions } from "@bitwarden/components";

/** Shared by the list and the edit page, so both ask the same question. */
export function accessRuleDeleteConfirmOptions(ruleName: string): SimpleDialogOptions {
  return {
    title: { key: "pamAccessRuleDeleteConfirmTitle" },
    content: { key: "pamAccessRuleDeleteConfirmContent", placeholders: [ruleName] },
    acceptButtonText: { key: "delete" },
    cancelButtonText: { key: "cancel" },
    type: "danger",
  };
}
