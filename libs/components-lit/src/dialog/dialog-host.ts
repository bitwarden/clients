import { ContextProvider } from "@lit/context";
import { ReactiveController, ReactiveControllerHost, render } from "lit";

import { getFocusableElements } from "../core/focus";

import { DIALOG_CLOSE_ATTRIBUTE } from "./dialog-close";
import { AutofocusFallbackHost, DialogContent, DialogRef, dialogRefContext } from "./dialog-ref";

const DISABLED_BY_DIALOG = "data-bit-disabled-by-dialog";
const AUTOFOCUS_SELECTOR = "[autofocus], [bitautofocus], [appautofocus]";

/** Renders `content` into `host`'s light DOM. Returns the content element, if any. */
export function mountContent<R, D>(
  host: HTMLElement,
  content: DialogContent<R, D>,
  ref: DialogRef<R, D>,
): HTMLElement | undefined {
  let resolved = typeof content === "function" ? content(ref) : content;
  if (typeof resolved === "string") {
    resolved = document.createElement(resolved);
  }
  if (resolved instanceof HTMLElement) {
    if (resolved.localName.includes("-")) {
      Object.assign(resolved, { dialogRef: ref, data: ref.data });
    }
    host.append(resolved);
    return resolved;
  }
  render(resolved, host);
  return host.firstElementChild instanceof HTMLElement ? host.firstElementChild : undefined;
}

/** Waits for Lit elements in the content to render. */
async function settle(root: HTMLElement) {
  const pending = Array.from(root.querySelectorAll("*"))
    .map((el) => (el as Partial<{ updateComplete: Promise<unknown> }>).updateComplete)
    .filter(Boolean);
  await Promise.all(pending);
}

function isFallbackHost(el: Element): el is HTMLElement & AutofocusFallbackHost {
  return typeof (el as Partial<AutofocusFallbackHost>).autofocusFallback === "function";
}

/**
 * Moves focus into new dialog content: an `[autofocus]` element, else the content's
 * `autofocusFallback()` (e.g. `bit-dialog`'s heading), else the first tabbable element.
 */
export async function focusInitial(content: HTMLElement, container: HTMLElement) {
  await settle(content);
  const autofocus = content.querySelector<HTMLElement>(AUTOFOCUS_SELECTOR);
  if (autofocus) {
    autofocus.focus();
    return;
  }
  const fallbackHost = Array.from(content.querySelectorAll("*")).find(isFallbackHost);
  const fallback = fallbackHost?.autofocusFallback() ?? getFocusableElements(container)[0];
  (fallback ?? container).focus();
}

/**
 * Shared by the modal container and drawer host: provides the ref to content, handles
 * `data-bit-dialog-close` clicks and disables those elements while `disableClose` is set.
 */
export class DialogHostController implements ReactiveController {
  private readonly provider: ContextProvider<typeof dialogRefContext>;
  private ref?: DialogRef<any, any>;

  constructor(private readonly host: ReactiveControllerHost & HTMLElement) {
    this.provider = new ContextProvider(host, dialogRefContext, undefined);
    host.addController(this);
    host.addEventListener("click", this.onClick);
  }

  setRef(ref: DialogRef<any, any>) {
    this.ref?.removeEventListener("change", this.onChange);
    this.ref = ref;
    ref.addEventListener("change", this.onChange);
    this.provider.setValue(ref, true);
  }

  hostConnected() {
    this.ref?.addEventListener("change", this.onChange);
  }

  hostUpdated() {
    this.syncCloseElements();
  }

  hostDisconnected() {
    this.ref?.removeEventListener("change", this.onChange);
  }

  private onChange = () => {
    this.syncCloseElements();
    this.host.requestUpdate();
  };

  private syncCloseElements() {
    const disable = !!this.ref?.disableClose;
    for (const el of Array.from(
      this.host.querySelectorAll<HTMLElement>(`[${DIALOG_CLOSE_ATTRIBUTE}]`),
    )) {
      if (disable && !el.hasAttribute("disabled")) {
        el.setAttribute("disabled", "");
        el.setAttribute(DISABLED_BY_DIALOG, "");
      } else if (!disable && el.hasAttribute(DISABLED_BY_DIALOG)) {
        el.removeAttribute("disabled");
        el.removeAttribute(DISABLED_BY_DIALOG);
      }
    }
  }

  private onClick = (event: Event) => {
    const ref = this.ref;
    if (!ref) {
      return;
    }
    for (const el of event.composedPath()) {
      if (el === this.host) {
        return;
      }
      if (!(el instanceof HTMLElement)) {
        continue;
      }
      if (el.hasAttribute(DIALOG_CLOSE_ATTRIBUTE)) {
        if (ref.disableClose || el.hasAttribute("disabled")) {
          return;
        }
        const attr = el.getAttribute(DIALOG_CLOSE_ATTRIBUTE);
        const result =
          (el as HTMLElement & { dialogCloseResult?: unknown }).dialogCloseResult ??
          (attr === "" ? undefined : attr);
        void ref.close(result);
        return;
      }
    }
  };
}
