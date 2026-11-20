import { Dialog, DialogRef } from "@angular/cdk/dialog";
import { inject } from "@angular/core";

/**
 * Returns a predicate that is true when a dialog other than the caller's own is on top.
 * Must be called in an injection context.
 */
export function injectObscuredByDialog(): () => boolean {
  const dialog = inject(Dialog);
  // CDK provides the real DialogRef to dialog content, so this is the same object as in `openDialogs`.
  const ownDialog = inject(DialogRef, { optional: true });

  return () => {
    const top = dialog.openDialogs.at(-1);
    return top != null && top !== ownDialog;
  };
}
