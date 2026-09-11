import { SimpleDialogOptions } from "@bitwarden/components";

/** Confirmation copy for leaving a PAM edit form that still holds unsaved input. */
export function discardEditsConfirmOptions(): SimpleDialogOptions {
  return {
    title: { key: "discardEditsTitle" },
    content: { key: "discardEditsConfirmation" },
    acceptButtonText: { key: "discardEdits" },
    cancelButtonText: { key: "keepEditing" },
    type: "warning",
  };
}

/** Confirmation copy for leaving a PAM create/edit form that still holds unsaved input. */
export function discardConfirmOptions({
  editing,
  createTitleKey,
}: {
  editing: boolean;
  createTitleKey: string;
}): SimpleDialogOptions {
  return editing
    ? discardEditsConfirmOptions()
    : {
        title: { key: createTitleKey },
        content: { key: "pamAccessRuleDiscardContent" },
        acceptButtonText: { key: "pamAccessRuleDiscardConfirm" },
        cancelButtonText: { key: "cancel" },
        type: "warning",
      };
}
