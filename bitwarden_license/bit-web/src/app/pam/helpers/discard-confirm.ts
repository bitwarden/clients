import { SimpleDialogOptions } from "@bitwarden/components";

export function discardEditsConfirmOptions(): SimpleDialogOptions {
  return {
    title: { key: "discardEditsTitle" },
    content: { key: "discardEditsConfirmation" },
    acceptButtonText: { key: "discardEdits" },
    cancelButtonText: { key: "keepEditing" },
    type: "warning",
  };
}

/**
 * Creating names the thing being abandoned, so the caller supplies that title. The body and button
 * default to the PAM-wide discard copy.
 */
export function discardConfirmOptions({
  editing,
  createTitleKey,
  createContentKey = "pamDiscardContent",
  createConfirmKey = "pamDiscardConfirm",
}: {
  editing: boolean;
  createTitleKey: string;
  createContentKey?: string;
  createConfirmKey?: string;
}): SimpleDialogOptions {
  return editing
    ? discardEditsConfirmOptions()
    : {
        title: { key: createTitleKey },
        content: { key: createContentKey },
        acceptButtonText: { key: createConfirmKey },
        cancelButtonText: { key: "cancel" },
        type: "warning",
      };
}
