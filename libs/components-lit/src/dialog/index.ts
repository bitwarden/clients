/**
 * Dialogs and drawers.
 *
 * - `openDialog(content, config)` returns a `DialogRef` (`closed` promise, `close(result)`,
 *   `data`, `disableClose`, `closePredicate`). Replaces `DialogService.open` and `DIALOG_DATA`:
 *   content is an element, tag name, Lit template or `(ref) => …`; custom elements receive
 *   `dialogRef` and `data` properties, and descendants can request `dialogRefContext`.
 * - `openSimpleDialog(options)` resolves `true` when accepted; `openSimpleDialogRef` returns the ref.
 * - `openDrawer(content, config)` / `DrawerRef.stack()`; layouts render `<bit-drawer-outlet>` and
 *   coordinate push mode through `drawerStack`.
 * - `<bit-dialog>`, `<bit-simple-dialog>`; `data-bit-dialog-close` / `dialogClose(result)` replace
 *   `bitDialogClose`.
 * - `closeAllDialogs()` for app-level events such as locking.
 *
 * Modal dialogs are native `<dialog>`s opened with `showModal()`, so the rest of the page is inert:
 * overlays opened from dialog content must live inside it (as slotted content or in a shadow root),
 * or be appended to `getOverlayRoot()`.
 */
export * from "./dialog";
export * from "./dialog-close";
export * from "./dialog-ref";
export * from "./dialog-service";
export * from "./drawer";
export * from "./simple-dialog";
export * from "./simple-dialog-types";
