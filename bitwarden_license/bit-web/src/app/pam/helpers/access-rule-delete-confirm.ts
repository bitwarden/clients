import { SimpleDialogOptions } from "@bitwarden/components";

/**
 * Confirmation copy for deleting a single access rule. Shared so the list and the edit
 * page ask the same question — deleting from either place is the same destructive act,
 * and the two must not drift apart.
 */
export function accessRuleDeleteConfirmOptions(ruleName: string): SimpleDialogOptions {
  return {
    title: { key: "pamAccessRuleDeleteConfirmTitle" },
    content: { key: "pamAccessRuleDeleteConfirmContent", placeholders: [ruleName] },
    acceptButtonText: { key: "delete" },
    cancelButtonText: { key: "cancel" },
    type: "danger",
  };
}
