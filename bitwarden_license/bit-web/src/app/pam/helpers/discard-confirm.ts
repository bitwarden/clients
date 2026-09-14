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

/**
 * Confirmation copy for leaving a PAM create/edit form that still holds unsaved input.
 *
 * Creating names the thing being abandoned, so the caller supplies that title. The body and the
 * confirm button name nothing, so they default to the PAM-wide discard copy and every surface asks
 * the same question; a surface that needs its own wording overrides them. A page that only ever
 * edits has no title to name and calls {@link discardEditsConfirmOptions} directly.
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
