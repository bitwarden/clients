import { Dialog, DialogRef } from "@angular/cdk/dialog";

/**
 * Test-only `DialogRef` whose overlay is `overlayElement`. `mock<DialogRef>()` can't supply it: its
 * DeepPartial argument recurses into the DOM types and fails to typecheck.
 */
export const dialogOver = (overlayElement: HTMLElement) =>
  ({ overlayRef: { overlayElement } }) as unknown as DialogRef;

/** A `Dialog` stub backed by a caller-owned array, so a test can push and pop open dialogs. */
export const dialogWith = (openDialogs: DialogRef[]) => ({ openDialogs }) as unknown as Dialog;
