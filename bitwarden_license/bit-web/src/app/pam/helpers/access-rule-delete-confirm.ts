import type { SimpleDialogOptions } from "@bitwarden/components";

/** Shared by the list and the edit page, so both ask the same question. */
export function accessRuleDeleteConfirmOptions(): SimpleDialogOptions {
  return {
    title: { key: "pamAccessRuleDeleteConfirmTitle" },
    content: { key: "pamAccessRuleDeleteConfirmDescription" },
    acceptButtonText: { key: "delete" },
    cancelButtonText: { key: "cancel" },
    type: "danger",
  };
}
