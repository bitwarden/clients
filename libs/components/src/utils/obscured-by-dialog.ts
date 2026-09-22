import { Dialog } from "@angular/cdk/dialog";
import { ElementRef, inject } from "@angular/core";

/**
 * Returns a predicate that is true when a dialog is open and the calling component
 * sits outside it. Must be called in an injection context.
 */
export function injectObscuredByDialog(): () => boolean {
  const dialog = inject(Dialog);
  const host = inject(ElementRef<HTMLElement>);

  return () => {
    const top = dialog.openDialogs.at(-1);
    return top != null && !top.overlayRef.overlayElement.contains(host.nativeElement);
  };
}
