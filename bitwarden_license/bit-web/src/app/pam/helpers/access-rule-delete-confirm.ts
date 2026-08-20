import type { PamConfirmDialogParams } from "../confirm-dialog/pam-confirm-dialog.component";

/**
 * Confirmation copy for deleting a single access rule. Shared so the list and the edit
 * page ask the same question — deleting from either place is the same destructive act,
 * and the two must not drift apart.
 *
 * The red glyph over a blue accept button is why this cannot go through `openSimpleDialog`;
 * see `PamConfirmDialogComponent`. `bwi-clear` is the circled X — `bwi-error`, despite the
 * name, draws an octagon.
 */
export function accessRuleDeleteConfirmParams(ruleName: string): PamConfirmDialogParams {
  return {
    title: { key: "pamAccessRuleDeleteConfirmTitle" },
    content: { key: "pamAccessRuleDeleteConfirmContent", placeholders: [ruleName] },
    acceptButtonText: { key: "delete" },
    cancelButtonText: { key: "cancel" },
    icon: "bwi-clear",
    iconClass: "tw-text-danger",
    acceptButtonType: "primary",
  };
}
