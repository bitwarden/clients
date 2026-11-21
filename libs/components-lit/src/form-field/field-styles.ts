export type FieldSize = "base" | "large";

export type FieldContainerState = {
  size: FieldSize;
  hasError: boolean;
  readOnly: boolean;
  disabled: boolean;
  focusVisible: boolean;
  /** Draw the select chevron (native-select-like controls). */
  selectArrow?: boolean;
};

/**
 * Bordered box around the control and its start/end content. The `tw-test-*` classes let stories
 * pin hover/focus states for visual snapshots.
 */
export function fieldContainerClasses(state: FieldContainerState): string {
  const { size, hasError, readOnly, disabled, focusVisible, selectArrow } = state;
  return [
    "tw-group/form-field",
    "tw-flex",
    "tw-w-full",
    "tw-border",
    "tw-rounded-xl",
    "tw-border-solid",
    "tw-border-border-strong",
    "tw-bg-bg-secondary",
    "tw-transition-colors",
    "tw-relative",
    ...(disabled ? ["tw-border-border-base"] : []),
    ...(focusVisible ? ["tw-border-border-brand", "tw-ring-1", "tw-ring-border-brand"] : []),
    "[&.tw-test-focus-visible]:tw-border-border-brand",
    "[&.tw-test-focus-visible]:tw-ring-1",
    "[&.tw-test-focus-visible]:tw-ring-border-brand",
    ...(selectArrow
      ? [
          "after:tw-pointer-events-none",
          "after:tw-absolute",
          // spacing here to match visual spacing used by ng-select arrow
          "after:tw-end-[calc(theme(spacing.3)_+_2px)]",
          "after:tw-top-[calc(50%_-_1px)]",
          "after:tw-rotate-[45deg]",
          "after:-tw-translate-y-1/2",
          "after:tw-size-2",
          "after:tw-border-fg-heading",
          "after:tw-border-r-[2px]",
          "after:tw-border-b-[2px]",
          "after:tw-rounded-[2px]",
          "after:tw-content-['']",
        ]
      : []),
    ...(size === "large" ? ["tw-text-base/6", "tw-min-h-12"] : ["tw-text-sm/5", "tw-min-h-10"]),
    ...(hasError
      ? focusVisible
        ? ["!tw-border-border-brand", "!tw-ring-border-brand", "tw-ring-1"]
        : [
            "!tw-ring-border-danger",
            "tw-ring-1",
            "!tw-border-border-danger",
            "[&.tw-test-focus-visible]:!tw-border-border-brand",
            "[&.tw-test-focus-visible]:!tw-ring-border-brand",
          ]
      : []),
    ...(readOnly
      ? [
          "tw-bg-transparent",
          "tw-border-transparent",
          ...(focusVisible ? ["!tw-border-border-focus", "!tw-ring-border-focus"] : []),
          "[&.tw-test-focus-visible]:!tw-border-border-focus",
          "[&.tw-test-focus-visible]:!tw-ring-border-focus",
        ]
      : focusVisible || disabled
        ? []
        : [
            "hover:tw-bg-bg-quaternary",
            "[&.tw-test-hover:not(.tw-test-focus-visible)]:tw-bg-bg-quaternary",
          ]),
  ].join(" ");
}

/** Classes for the native `<input>`/`<textarea>` inside the field container. */
export function fieldInputClasses({ textarea = false, readOnly = false } = {}): string {
  return [
    "tw-block",
    "tw-w-full",
    "tw-p-0",
    "tw-px-1",
    textarea ? "tw-h-auto tw-min-h-[30px] tw-resize-none" : "tw-h-full",
    ...(textarea && readOnly ? [] : ["tw-max-h-[50vh]", "tw-overflow-y-auto"]),
    "tw-placeholder-fg-body-subtle",
    "tw-border-none",
    "focus:tw-outline-none",
    "tw-bg-transparent",
    "tw-text-fg-heading",
    "selection:tw-bg-bg-brand-medium",
    "selection:tw-text-fg-heading",
    "disabled:tw-bg-bg-secondary",
    "disabled:!tw-placeholder-fg-inactive",
    "disabled:!tw-text-fg-inactive",
  ].join(" ");
}

/** Hint text below a control. */
export const hintClasses = "tw-text-muted tw-font-normal tw-text-xs";

/** Error text below a control, matching Angular's `bit-error`. */
export const errorClasses = "tw-text-danger tw-text-xs";
