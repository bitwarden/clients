import { sharedFolderKey } from "@bitwarden/bit-pam";
import type { SimpleDialogOptions } from "@bitwarden/components";


/** Shared by the list and the edit page, so both ask the same question. */
export function accessRuleDeleteConfirmOptions(
  sharedFolderTerminology = false,
): SimpleDialogOptions {
  return {
    title: { key: "pamAccessRuleDeleteConfirmTitle" },
    content: {
      key: sharedFolderKey("pamAccessRuleDeleteConfirmDescription", sharedFolderTerminology),
    },
    acceptButtonText: { key: "delete" },
    cancelButtonText: { key: "cancel" },
    type: "danger",
  };
}
