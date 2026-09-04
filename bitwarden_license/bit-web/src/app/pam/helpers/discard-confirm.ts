import { SimpleDialogOptions } from "@bitwarden/components";

/**
 * Confirmation copy for leaving a PAM create/edit form that still holds unsaved input.
 *
 * Creating names the thing being abandoned, so the caller supplies that title; the rest of the
 * create wording is the same question wherever it is asked. Editing loses only the edits — the
 * record itself survives — so it takes the repo's shared discard-edits copy instead.
 */
export function discardConfirmOptions({
  editing,
  createTitleKey,
}: {
  editing: boolean;
  createTitleKey: string;
}): SimpleDialogOptions {
  return editing
    ? {
        title: { key: "discardEditsTitle" },
        content: { key: "discardEditsConfirmation" },
        acceptButtonText: { key: "discardEdits" },
        cancelButtonText: { key: "keepEditing" },
        type: "warning",
      }
    : {
        title: { key: createTitleKey },
        content: { key: "pamAccessRuleDiscardContent" },
        acceptButtonText: { key: "pamAccessRuleDiscardConfirm" },
        cancelButtonText: { key: "cancel" },
        type: "warning",
      };
}
