import { html, nothing } from "lit";

import { registerOverlay, popoverResetCss } from "../core/overlay";
import { autoUpdate, computePosition } from "../core/position";
import "../icon/icon";
import { BitwardenIcon } from "../icon/shared-icon";
import "../icon-tile/icon-tile";
import {
  IconTileOptions,
  resolveIconTileColor,
  resolveIconTileVariant,
} from "../icon-tile/icon-tile-options";

/**
 * Styles for the listbox panel and the field's chevron. The panel is a `popover="manual"` element
 * in the component's shadow root, so it renders in the top layer (also inside modal dialogs).
 *
 * @internal
 */
export const listboxCss = `
  .listbox-panel[popover] {
    ${popoverResetCss}
  }
  /* An inline icon-tile host gains descender space; force a flex box so it stays centered. */
  bit-icon-tile {
    display: flex;
  }
  .arrow {
    width: 8px;
    height: 8px;
    border-style: solid;
    border-color: var(--color-fg-heading);
    border-width: 0 2px 2px 0;
    border-radius: 1px;
    transform: translateY(-2px) rotate(45deg);
    transition: transform 250ms;
  }
  .arrow.open {
    transform: translateY(0) rotate(-135deg);
  }
`;

/** @internal Classes for the panel's visible box. */
export const listboxPanelClasses =
  "tw-bg-bg-primary tw-border tw-border-solid tw-border-border-light tw-rounded-lg tw-shadow-md tw-p-2 tw-text-sm tw-text-fg-body";

/** @internal Classes for the scrolling `role="listbox"` element. */
export const listboxClasses =
  "tw-max-h-60 tw-overflow-y-auto tw-flex tw-flex-col tw-gap-1 tw-outline-none";

/** @internal Matches the ng-select option states of `libs/components`. */
export function optionClasses({
  selected,
  active,
  disabled,
}: {
  selected: boolean;
  active: boolean;
  disabled: boolean;
}): string {
  const background =
    selected && active
      ? "tw-bg-bg-brand-soft"
      : selected || active
        ? "tw-bg-bg-brand-softer"
        : "tw-bg-bg-primary";
  const text = disabled
    ? "tw-text-fg-inactive"
    : selected || active
      ? "tw-text-fg-heading"
      : "tw-text-fg-body";
  return [
    "tw-p-2",
    "tw-rounded-lg",
    "tw-font-medium",
    "tw-whitespace-nowrap",
    "tw-transition-colors",
    "tw-duration-[250ms]",
    "tw-select-none",
    disabled ? "tw-cursor-default" : "tw-cursor-pointer",
    background,
    text,
  ].join(" ");
}

/** @internal A plain icon or an `xs` icon tile, shared by the selected value and option rows. */
export function renderLeadingVisual(item: {
  icon?: BitwardenIcon | string;
  iconTile?: IconTileOptions;
  disabled?: boolean;
}) {
  const tile = item.iconTile;
  if (tile) {
    return html`<bit-icon-tile
      icon=${tile.icon}
      variant=${resolveIconTileVariant(tile, item.disabled)}
      color=${resolveIconTileColor(tile, item.disabled) ?? nothing}
      emphasis=${tile.emphasis ?? "subtle"}
      size="xs"
    ></bit-icon-tile>`;
  }
  if (item.icon != null) {
    return html`<bit-icon name=${item.icon as BitwardenIcon} fixed-width></bit-icon>`;
  }
  return nothing;
}

/** @internal The chevron at the end of the field. */
export function renderArrow(open: boolean) {
  return html`<span
    class="tw-flex tw-shrink-0 tw-items-center tw-justify-center tw-w-[25px] tw-pe-3 tw-box-content"
    aria-hidden="true"
    ><span class="arrow ${open ? "open" : ""}"></span
  ></span>`;
}

export type ListboxPopupOptions = {
  /** The component; pointer presses inside it (including its shadow root) don't dismiss. */
  host: HTMLElement;
  /** The element the panel aligns to and matches the width of. */
  anchor: () => HTMLElement | null | undefined;
  panel: () => HTMLElement | null | undefined;
  /** Escape (while focus is outside the component) or a press outside. */
  onDismiss: () => void;
};

/**
 * Shows a listbox panel below (or above) its field: top-layer popover, positioning, outside-press
 * dismissal, and topmost-overlay registration so Escape closes the listbox before an enclosing
 * dialog.
 *
 * @internal
 */
export class ListboxPopup {
  private cleanups: (() => void)[] = [];

  constructor(private readonly options: ListboxPopupOptions) {}

  get isOpen() {
    return this.cleanups.length > 0;
  }

  show() {
    const anchor = this.options.anchor();
    const panel = this.options.panel();
    if (this.isOpen || !anchor || !panel) {
      return;
    }
    if (!panel.matches(":popover-open")) {
      panel.showPopover();
    }

    const stopPosition = autoUpdate(anchor, panel, () => {
      panel.style.width = `${anchor.getBoundingClientRect().width}px`;
      computePosition(anchor, panel, { placements: ["bottom-start", "top-start"], offset: 2 });
    });

    const unregister = registerOverlay({
      onKeydown: (event) => {
        if (event.key !== "Escape") {
          return false;
        }
        event.preventDefault();
        this.options.onDismiss();
        return true;
      },
    });

    const onPointerDown = (event: PointerEvent) => {
      if (!event.composedPath().includes(this.options.host)) {
        this.options.onDismiss();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);

    this.cleanups = [
      stopPosition,
      unregister,
      () => document.removeEventListener("pointerdown", onPointerDown, true),
      () => {
        if (panel.matches(":popover-open")) {
          panel.hidePopover();
        }
      },
    ];
  }

  hide() {
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
  }
}

/** @internal Case- and diacritic-insensitive substring match, like ng-select's default search. */
export function matchesSearch(text: string | undefined, term: string): boolean {
  const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return normalize(text ?? "").includes(normalize(term));
}
