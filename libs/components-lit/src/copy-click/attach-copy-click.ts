import { t } from "../core/i18n";
import { showToast as showBitToast } from "../toast/toast-service";

export type CopyClickToastVariant = "success" | "error" | "info" | "warning";

export type CopyClickToast = { variant: CopyClickToastVariant; message: string };

export type CopyClickOptions = {
  /** Text written to the clipboard on click. */
  value: string;
  /** When set, the toast reads "<valueLabel> copied" instead of the default message. */
  valueLabel?: string;
  /** Show a toast after copying: `true` for a success toast, or a specific variant. */
  showToast?: boolean | CopyClickToastVariant;
};

export type CopyClickHandle = {
  update(options: CopyClickOptions): void;
  destroy(): void;
};

/** Detail of the `copied` event dispatched on the element after a copy. */
export type CopiedEventDetail = { value: string };

type ClipboardWriter = (text: string) => void | Promise<void>;
type ToastHandler = (toast: CopyClickToast) => void;

let writeClipboard: ClipboardWriter = (text) => navigator.clipboard.writeText(text);
let showToast: ToastHandler | undefined = showBitToast;

/**
 * Replaces the clipboard implementation, e.g. with the platform's `copyToClipboard` where
 * `navigator.clipboard` isn't available (browser extension background, Electron).
 */
export function setCopyClickClipboard(writer: ClipboardWriter) {
  writeClipboard = writer;
}

/**
 * Replaces how copy toasts are shown. Defaults to the library's `showToast`; pass `undefined` to
 * show none.
 */
export function setCopyClickToastHandler(handler: ToastHandler | undefined) {
  showToast = handler;
}

/**
 * Copies `options.value` to the clipboard when `element` is clicked, optionally showing a toast.
 * Dispatches a bubbling, composed `copied` event with the value afterwards. Framework-neutral;
 * used by the `copyClick()` Lit directive and `<bit-copy-click>`.
 */
export function attachCopyClick(element: HTMLElement, initial: CopyClickOptions): CopyClickHandle {
  let options = initial;

  const onClick = async () => {
    const { value, valueLabel, showToast: toast } = options;
    await writeClipboard(value);
    element.dispatchEvent(
      new CustomEvent<CopiedEventDetail>("copied", {
        detail: { value },
        bubbles: true,
        composed: true,
      }),
    );
    if (toast !== undefined && toast !== false) {
      showToast?.({
        variant: toast === true ? "success" : toast,
        message: valueLabel ? t("valueCopied", valueLabel) : t("copySuccessful"),
      });
    }
  };

  element.addEventListener("click", onClick);

  return {
    update(next) {
      options = next;
    },
    destroy() {
      element.removeEventListener("click", onClick);
    },
  };
}
