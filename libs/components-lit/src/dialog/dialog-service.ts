import "./dialog-container";
import { mountContent } from "./dialog-host";
import { DialogConfig, DialogContent, DialogRef } from "./dialog-ref";
import { drawerStack } from "./drawer";
import "./simple-configurable-dialog";
import { SimpleDialogOptions } from "./simple-dialog-types";

const openDialogs = new Set<DialogRef<any, any>>();

/**
 * Opens `content` in a modal dialog, replacing `DialogService.open`.
 *
 * ```ts
 * const ref = openDialog<boolean, { animal: string }>(
 *   (ref) => html`<bit-dialog heading="Pet">${ref.data.animal}</bit-dialog>`,
 *   { data: { animal: "panda" } },
 * );
 * const result = await ref.closed;
 * ```
 */
export function openDialog<R = unknown, D = unknown>(
  content: DialogContent<R, D>,
  config: DialogConfig<D, R> = {},
): DialogRef<R, D> {
  const container = document.createElement("bit-dialog-container");
  const ref: DialogRef<R, D> = new DialogRef<R, D>({
    data: config.data as D,
    disableClose: config.disableClose,
    closePredicate: config.closePredicate,
    onClose: () => {
      openDialogs.delete(ref);
      container.teardown();
    },
  });
  container.ref = ref;
  container.config = config;
  openDialogs.add(ref);
  document.body.append(container);
  ref.content = mountContent(container, content, ref);
  void container.openModal();
  return ref;
}

/**
 * Opens a configurable simple dialog. Resolves `true` if the user accepted.
 *
 * ```ts
 * if (await openSimpleDialog({ title: { key: "deleteItem" }, content: "…", type: "warning" })) { … }
 * ```
 */
export async function openSimpleDialog(options: SimpleDialogOptions): Promise<boolean> {
  return !!(await openSimpleDialogRef(options).closed);
}

/** Like `openSimpleDialog`, but returns the ref so the dialog can be closed from code. */
export function openSimpleDialogRef(
  options: SimpleDialogOptions,
): DialogRef<boolean, SimpleDialogOptions> {
  return openDialog<boolean, SimpleDialogOptions>("bit-simple-configurable-dialog", {
    data: options,
    disableClose: options.disableClose,
    position: "center",
  });
}

/**
 * Closes all dialogs and drawers, ignoring `closePredicate`s. Call when the vault locks or on
 * navigation the dialogs don't observe themselves.
 */
export function closeAllDialogs() {
  drawerStack.forceCloseAll();
  for (const ref of [...openDialogs].reverse()) {
    ref._forceClose();
  }
}
