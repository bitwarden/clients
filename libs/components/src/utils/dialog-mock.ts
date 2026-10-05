import { Dialog, DialogRef } from "@angular/cdk/dialog";

/**
 * A `DialogRef` whose overlay is `overlayElement`. Only `overlayRef.overlayElement` is ever read by
 * the code under test, and `mock<DialogRef>()` cannot supply it: its DeepPartial argument recurses
 * into the DOM types and fails to typecheck.
 *
 * Test-only. Deliberately not exported from the `utils` barrel.
 */
export const dialogOver = (overlayElement: HTMLElement) =>
  ({ overlayRef: { overlayElement } }) as unknown as DialogRef;

/** A `Dialog` stub backed by a caller-owned array, so a test can push and pop open dialogs. */
export const dialogWith = (openDialogs: DialogRef[]) => ({ openDialogs }) as unknown as Dialog;
