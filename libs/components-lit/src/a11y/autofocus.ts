import { attachDirective } from "./attach-directive";

export const AUTOFOCUS_ATTR = "bit-autofocus";

function detectMobileBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }
  const uaData = (navigator as Navigator & { userAgentData?: { mobile: boolean } }).userAgentData;
  return uaData?.mobile ?? /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Autofocus is skipped on mobile, where it pops up the keyboard. Overridable for tests/hosts. */
let autofocusDisabled = detectMobileBrowser();

export function setAutofocusDisabled(disabled: boolean) {
  autofocusDisabled = disabled;
}

/**
 * Elements under `root` (piercing shadow roots) marked with `bit-autofocus`.
 */
export function queryForAutofocusDescendants(root: ParentNode): HTMLElement[] {
  const result: HTMLElement[] = [];
  const visit = (node: ParentNode) => {
    for (const el of Array.from(node.querySelectorAll<HTMLElement>("*"))) {
      if (el.hasAttribute(AUTOFOCUS_ATTR)) {
        result.push(el);
      }
      if (el.shadowRoot) {
        visit(el.shadowRoot);
      }
    }
  };
  visit(root);
  return result;
}

export type AutofocusHandle = { update(enabled?: boolean): void; destroy(): void };

/**
 * Focuses `el` once, when it becomes visible. Marks it with `bit-autofocus` so containers
 * (`attachAutofocusFallback`, the router focus manager) defer to it.
 *
 * Retries until `el` is focused *and* the document owns focus: Safari's extension popover gives its
 * web view keyboard focus after load and discards anything focused before that.
 */
export function attachAutofocus(el: HTMLElement, enabled = true): AutofocusHandle {
  let focused = false;
  let active = false;
  let frame = 0;
  const visibility = new IntersectionObserver(() => attempt());

  const attempt = () => {
    if (focused || !active || autofocusDisabled) {
      return;
    }
    if (!el.matches(":focus")) {
      el.focus();
    }
    focused = el.matches(":focus") && document.hasFocus();
    if (focused) {
      stop();
    }
  };

  const start = () => {
    el.setAttribute(AUTOFOCUS_ATTR, "");
    active = true;
    visibility.observe(el);
    window.addEventListener("focus", attempt);
    // Let the rest of the first render (and any parent focus management) settle first.
    frame = requestAnimationFrame(attempt);
  };

  const stop = () => {
    cancelAnimationFrame(frame);
    visibility.disconnect();
    window.removeEventListener("focus", attempt);
  };

  const setEnabled = (value = true) => {
    if (value && !active && !focused) {
      start();
    } else if (!value) {
      active = false;
      el.removeAttribute(AUTOFOCUS_ATTR);
      stop();
    }
  };
  setEnabled(enabled);

  return {
    update: setEnabled,
    destroy() {
      active = false;
      stop();
      el.removeAttribute(AUTOFOCUS_ATTR);
    },
  };
}

/** Lit directive for `attachAutofocus`: `html\`<input ${autofocus()} />\`` */
export const autofocus = attachDirective("autofocus", attachAutofocus);

export type AutofocusFallbackHandle = {
  update(fallback: HTMLElement | null | undefined): void;
  destroy(): void;
};

/**
 * Focuses `fallback` when `container` has no `bit-autofocus` descendants, e.g. a dialog title.
 * Runs once per container, after a macrotask so other focus management happens first.
 */
export function attachAutofocusFallback(
  container: HTMLElement,
  fallback: HTMLElement | null | undefined,
): AutofocusFallbackHandle {
  let focused = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = async (target: HTMLElement | null | undefined) => {
    clearTimeout(timer);
    if (focused || autofocusDisabled || !target) {
      return;
    }
    // Wait for Lit hosts to finish rendering so descendants are in the DOM.
    await (container as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete;
    if (queryForAutofocusDescendants(container).length > 0) {
      return;
    }
    timer = setTimeout(() => {
      target.focus();
      focused = target.matches(":focus");
    }, 0);
  };
  void schedule(fallback);

  return {
    update: (next) => void schedule(next),
    destroy: () => clearTimeout(timer),
  };
}

/** Lit directive for `attachAutofocusFallback`. */
export const autofocusFallback = attachDirective("autofocusFallback", attachAutofocusFallback);
