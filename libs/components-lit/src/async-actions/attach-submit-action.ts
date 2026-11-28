import { AsyncHandler, runAsyncAction } from "../core/async-action";

export type SubmitContext = {
  form: HTMLFormElement;
  /** Entries including the submitter's `name`/`value`. */
  formData: FormData;
  /** Whether every control passed validation when the submit started. */
  valid: boolean;
  submitter: HTMLElement | null;
};

export type SubmitActionOptions = {
  /** Called on submit. The form shows loading until the returned promise settles. */
  handler?: AsyncHandler<[SubmitContext]>;
  /** Allow submitting while every control in the form is disabled. */
  allowDisabledFormSubmit?: boolean;
};

export type SubmitActionHandle = {
  update(options: SubmitActionOptions): void;
  readonly loading: boolean;
  /** Whether a control changed since load or the last reset. */
  readonly dirty: boolean;
  destroy(): void;
};

type ButtonLike = HTMLElement & {
  type: string;
  disabled: boolean;
  loading: boolean;
  form: HTMLFormElement | null;
};

type ControlLike = Element & {
  dirty?: boolean;
  markAsTouched?: () => void;
  checkValidity?: () => boolean;
};

const BUTTON_SELECTOR = "bit-button, bit-icon-button";

const registry = new Set<SubmitActionHandle>();

/** Whether any form with a submit action has unsaved changes (Angular `DirtyFormService`). */
export function hasDirtyForm(): boolean {
  for (const handle of registry) {
    if (handle.dirty) {
      return true;
    }
  }
  return false;
}

function isNativeDirty(el: Element) {
  if (el instanceof HTMLInputElement) {
    return el.type === "checkbox" || el.type === "radio"
      ? el.checked !== el.defaultChecked
      : el.value !== el.defaultValue;
  }
  if (el instanceof HTMLTextAreaElement) {
    return el.value !== el.defaultValue;
  }
  if (el instanceof HTMLSelectElement) {
    return Array.from(el.options).some((option) => option.selected !== option.defaultSelected);
  }
  return false;
}

/**
 * Gives a native `<form>` Angular's `bitSubmit` + `bitFormButton` behavior:
 *
 * - Submitting always runs `handler` (the form gets `novalidate`; our controls render their own
 *   errors) after marking every control touched so errors show.
 * - While the handler runs, `type="submit"` `bit-button`s show loading, other form buttons are
 *   disabled, and further submits are ignored.
 * - While a form button's own `action` runs, the other form buttons are disabled and submit is
 *   blocked.
 * - If every control is disabled the form can't be submitted, unless `allowDisabledFormSubmit`.
 * - Tracks dirtiness for `hasDirtyForm()`.
 *
 * Handler errors go to the handler registered with `setAsyncActionErrorHandler`.
 */
export function attachSubmitAction(
  form: HTMLFormElement,
  initialOptions: SubmitActionOptions,
): SubmitActionHandle {
  let options = initialOptions;
  let loading = false;
  /** Button whose own `action` is running. */
  let busyButton: ButtonLike | null = null;
  // Buttons we disabled, with their previous state, so we can restore them.
  const changed = new Map<ButtonLike, { disabled: boolean; loading: boolean }>();
  let applying = false;

  const previousNoValidate = form.noValidate;
  form.noValidate = true;

  const buttons = () =>
    Array.from(form.querySelectorAll<ButtonLike>(BUTTON_SELECTOR)).filter(
      (button) => button.form === form || !("form" in button),
    );

  const controls = () =>
    Array.from(form.elements).filter(
      (el) => !el.matches("button, fieldset, output, " + BUTTON_SELECTOR),
    ) as ControlLike[];

  const formDisabled = () => {
    if (options.allowDisabledFormSubmit) {
      return false;
    }
    const all = controls();
    return all.length > 0 && all.every((el) => el.matches(":disabled"));
  };

  const apply = () => {
    applying = true;
    const disabled = formDisabled();
    for (const button of buttons()) {
      const original = changed.get(button) ?? {
        disabled: button.disabled,
        loading: button.loading,
      };
      const isSubmit = button.type === "submit";
      let nextDisabled = original.disabled;
      let nextLoading = original.loading;
      if (loading && isSubmit) {
        nextLoading = true;
      } else if (loading || disabled || (busyButton && button !== busyButton)) {
        nextDisabled = true;
      }
      if (nextDisabled !== original.disabled || nextLoading !== original.loading) {
        changed.set(button, original);
      } else {
        changed.delete(button);
      }
      button.disabled = nextDisabled;
      if (button !== busyButton) {
        button.loading = nextLoading;
      }
    }
    // Let the attribute mutations from our own writes flush before reacting again.
    queueMicrotask(() => (applying = false));
  };

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    if (loading || busyButton || formDisabled()) {
      return;
    }
    const all = controls();
    all.forEach((el) => el.markAsTouched?.());
    const valid = all.every((el) => el.checkValidity?.() ?? true);
    const formData = new FormData(form, event.submitter);
    void runAsyncAction(
      options.handler,
      (value) => {
        loading = value;
        apply();
      },
      { form, formData, valid, submitter: event.submitter },
    );
  };

  const observer = new MutationObserver((records) => {
    if (applying) {
      return;
    }
    for (const record of records) {
      const target = record.target as ButtonLike;
      if (record.attributeName === "loading" && target.matches(BUTTON_SELECTOR)) {
        // A form button's own `action` started or finished.
        if (target.loading && !changed.has(target) && target.type !== "submit") {
          busyButton = target;
        } else if (!target.loading && target === busyButton) {
          busyButton = null;
        }
      }
    }
    apply();
  });
  observer.observe(form, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["disabled", "loading"],
  });

  const handle: SubmitActionHandle = {
    update(next) {
      options = next;
      apply();
    },
    get loading() {
      return loading;
    },
    get dirty() {
      return Array.from(form.elements).some((el) =>
        "dirty" in el ? !!(el as ControlLike).dirty : isNativeDirty(el),
      );
    },
    destroy() {
      observer.disconnect();
      form.removeEventListener("submit", onSubmit);
      form.noValidate = previousNoValidate;
      loading = false;
      busyButton = null;
      for (const [button, original] of changed) {
        button.disabled = original.disabled;
        button.loading = original.loading;
      }
      changed.clear();
      registry.delete(handle);
    },
  };

  form.addEventListener("submit", onSubmit);
  registry.add(handle);
  apply();
  return handle;
}
