const FOCUSABLE_SELECTOR = [
  "input:not([type='hidden']):not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

/** How long the revealed row stays highlighted before it starts fading out. */
export const SETTINGS_ROW_HIGHLIGHT_MS = 1500;
/** Matches `tw-duration-700` below; the transition classes are removed once the fade has finished. */
export const SETTINGS_ROW_HIGHLIGHT_FADE_MS = 700;

/** Soft background shown on the revealed row. Rounded so it follows the card's corners. */
const HIGHLIGHT_CLASSES = [
  "tw-bg-bg-brand-softer",
  "first:tw-rounded-t-xl",
  "last:tw-rounded-b-xl",
];
/** Fades the highlight out; reduced-motion users get a static highlight that simply clears. */
const FADE_CLASSES = [
  "tw-transition-colors",
  "tw-duration-700",
  "motion-reduce:tw-transition-none",
];

/** `focusVisible` is in the HTML spec and Chromium's FocusOptions but not yet in TypeScript's DOM lib. */
type RevealFocusOptions = FocusOptions & { focusVisible?: boolean };

export interface RevealSettingsRowOptions {
  /**
   * Whether the focused control should show its focus ring. Pass `true` when the reveal was
   * keyboard initiated so keyboard users keep the standard indicator; pointer-initiated reveals
   * rely on the row highlight instead. Engines without `focusVisible` support ignore it.
   */
  focusVisible?: boolean;
}

let activeHighlight: { row: HTMLElement; timers: ReturnType<typeof setTimeout>[] } | undefined;

/**
 * Removes the current row highlight, if any, and cancels its timers. Call it when the settings
 * view is destroyed so no timer outlives it.
 */
export function clearSettingsRowHighlight(): void {
  if (!activeHighlight) {
    return;
  }
  activeHighlight.timers.forEach((timer) => clearTimeout(timer));
  activeHighlight.row.classList.remove(...HIGHLIGHT_CLASSES, ...FADE_CLASSES);
  activeHighlight = undefined;
}

function highlightRow(row: HTMLElement): void {
  clearSettingsRowHighlight();
  row.classList.add(...FADE_CLASSES, ...HIGHLIGHT_CLASSES);

  const highlight: { row: HTMLElement; timers: ReturnType<typeof setTimeout>[] } = {
    row,
    timers: [],
  };
  highlight.timers.push(
    setTimeout(() => {
      // Removing only the background lets the transition fade it out.
      row.classList.remove("tw-bg-bg-brand-softer");
      highlight.timers.push(
        setTimeout(() => {
          row.classList.remove(...HIGHLIGHT_CLASSES, ...FADE_CLASSES);
          if (activeHighlight === highlight) {
            activeHighlight = undefined;
          }
        }, SETTINGS_ROW_HIGHLIGHT_FADE_MS),
      );
    }, SETTINGS_ROW_HIGHLIGHT_MS),
  );
  activeHighlight = highlight;
}

/**
 * Scrolls the setting row with id `rowId` into view, briefly highlights it and moves focus to its
 * first focusable control, or to the row itself (without an outline) when it has none. Call it
 * after the row's page is no longer `[hidden]` (e.g. from `afterNextRender`), since hidden
 * elements cannot take focus.
 *
 * @returns `false` when no element with `rowId` exists, so the caller can fall back to focusing
 * the page heading.
 */
export function revealSettingsRow(
  rowId: string,
  options: RevealSettingsRowOptions = {},
  root: Document = document,
): boolean {
  const row = root.getElementById(rowId);
  if (!row) {
    return false;
  }

  row.scrollIntoView?.({ block: "center" });
  highlightRow(row);

  const focusOptions: RevealFocusOptions = {
    preventScroll: true,
    focusVisible: options.focusVisible ?? false,
  };
  const control = row.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
  if (control) {
    control.focus(focusOptions);
    return true;
  }

  // The row is a plain container: never show the browser's default outline on it.
  if (!row.hasAttribute("tabindex")) {
    row.setAttribute("tabindex", "-1");
  }
  row.classList.add("tw-outline-none");
  const rowFocusOptions: RevealFocusOptions = { ...focusOptions, focusVisible: false };
  row.focus(rowFocusOptions);
  return true;
}
