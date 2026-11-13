import { css, html, TemplateResult, unsafeCSS } from "lit";
import { query, state } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import { getFocusableElements } from "../core/focus";
import { popoverResetCss } from "../core/overlay";

import { PopoverPosition } from "./popover-position";
import type { PopoverRef } from "./popover-ref";

/** Mirrors a logical position for RTL so the arrow CSS can stay physical, as in `libs/components`. */
function physicalPosition(position: PopoverPosition, rtl: boolean): PopoverPosition {
  if (!rtl) {
    return position;
  }
  const [side, align] = position.split("-");
  const flippedSide = side === "right" ? "left" : side === "left" ? "right" : side;
  const flippedAlign =
    side === "below" || side === "above"
      ? align === "start"
        ? "end"
        : align === "end"
          ? "start"
          : align
      : align;
  return `${flippedSide}-${flippedAlign}` as PopoverPosition;
}

/**
 * Shared shell for `bit-popover` and `bit-popover-panel`: the top-layer panel, its arrow, the
 * click-blocking backdrop, and the hooks `openPopover` drives.
 */
export abstract class BitPopoverBase extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: contents;
      }
      .backdrop {
        ${unsafeCSS(popoverResetCss)}
        inset: 0;
        width: 100vw;
        height: 100vh;
        max-width: none;
        max-height: none;
      }
      .panel {
        ${unsafeCSS(popoverResetCss)}
      }
      .arrow {
        position: absolute;
        z-index: 10;
        width: 0.75rem;
        height: 0.75rem;
        background: var(--color-bg-primary);
        border: 0 solid var(--color-border-base);
        box-shadow:
          0 4px 6px -1px rgb(0 0 0 / 0.1),
          0 2px 4px -2px rgb(0 0 0 / 0.1);
        transform: translate(var(--tx, 0), var(--ty, 0)) rotate(45deg);
      }
      .panel[data-side="right"] .arrow {
        left: 0.25rem;
        --tx: -75%;
        border-left-width: 1px;
        border-bottom-width: 1px;
        border-bottom-left-radius: 2px;
      }
      .panel[data-side="left"] .arrow {
        right: 0.25rem;
        --tx: 75%;
        border-right-width: 1px;
        border-top-width: 1px;
        border-top-right-radius: 2px;
      }
      .panel[data-position="right-start"] .arrow,
      .panel[data-position="left-start"] .arrow {
        top: 1.5rem;
        --ty: -50%;
      }
      .panel[data-position="right-center"] .arrow,
      .panel[data-position="left-center"] .arrow {
        top: 50%;
        --ty: -50%;
      }
      .panel[data-position="right-end"] .arrow,
      .panel[data-position="left-end"] .arrow {
        bottom: 1.5rem;
        --ty: 50%;
      }
      .panel[data-side="below"] .arrow {
        top: 0.25rem;
        --ty: -75%;
        border-top-width: 1px;
        border-left-width: 1px;
        border-top-left-radius: 2px;
      }
      .panel[data-side="above"] .arrow {
        bottom: 0.25rem;
        --ty: 75%;
        border-bottom-width: 1px;
        border-right-width: 1px;
        border-bottom-right-radius: 2px;
      }
      .panel[data-position="below-start"] .arrow,
      .panel[data-position="above-start"] .arrow {
        left: 1.5rem;
        --tx: -50%;
      }
      .panel[data-position="below-center"] .arrow,
      .panel[data-position="above-center"] .arrow {
        left: 50%;
        --tx: -50%;
      }
      .panel[data-position="below-end"] .arrow,
      .panel[data-position="above-end"] .arrow {
        right: 1.5rem;
        --tx: 50%;
      }
    `,
  ];

  @state() private physical?: PopoverPosition;

  @query(".panel") private panelEl!: HTMLElement;

  @query(".backdrop") private backdropEl!: HTMLElement;

  @query("section") private sectionEl!: HTMLElement;

  private activeRef?: PopoverRef;
  private onBackdrop?: () => void;

  /** Screen-reader name for the popover's dialog. */
  protected abstract get accessibleName(): string;

  /** Whether the popover is currently shown. */
  get isOpen() {
    return !!this.activeRef;
  }

  /** Closes the popover if it's open. */
  close() {
    this.activeRef?.close();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.close();
  }

  /** @internal */
  get _floating(): HTMLElement {
    return this.panelEl;
  }

  /** @internal */
  get _focusContainer(): HTMLElement {
    return this.sectionEl;
  }

  /** @internal Tracks the ref so a second `openPopover` replaces the first. */
  _setActiveRef(ref: PopoverRef | undefined) {
    const previous = this.activeRef;
    this.activeRef = ref;
    if (ref && previous && previous !== ref) {
      previous.close();
    }
  }

  /** @internal */
  _isActiveRef(ref: PopoverRef) {
    return this.activeRef === ref;
  }

  /** @internal */
  _showPanel({ backdrop, onBackdropClick }: { backdrop: boolean; onBackdropClick: () => void }) {
    this.onBackdrop = onBackdropClick;
    if (backdrop) {
      this.backdropEl.showPopover();
    }
    this.panelEl.showPopover();
  }

  /** @internal */
  _hidePanel() {
    for (const el of [this.panelEl, this.backdropEl]) {
      if (el?.matches(":popover-open")) {
        el.hidePopover();
      }
    }
    this.onBackdrop = undefined;
  }

  /** @internal */
  _setPosition(position: PopoverPosition) {
    this.physical = physicalPosition(position, getComputedStyle(this.panelEl).direction === "rtl");
  }

  /** @internal Moves focus into the popover when it opens. */
  _focusInitial() {
    getFocusableElements(this.sectionEl)[0]?.focus();
  }

  protected renderShell(content: TemplateResult, sectionClass = "") {
    return html`
      <div class="backdrop" popover="manual" @click=${() => this.onBackdrop?.()}></div>
      <div
        class="panel"
        part="panel"
        popover="manual"
        data-position=${this.physical ?? ""}
        data-side=${this.physical?.split("-")[0] ?? ""}
      >
        <section
          class="tw-relative ${sectionClass}"
          role="dialog"
          aria-modal="true"
          aria-label=${this.accessibleName}
        >
          <div
            class="tw-overflow-hidden tw-rounded-xl tw-shadow-md tw-border tw-border-solid tw-border-border-base"
          >
            <div
              class="tw-relative tw-z-20 tw-max-w-[22.5rem] tw-break-words tw-bg-bg-primary tw-text-fg-body"
            >
              ${content}
            </div>
          </div>
          <div class="arrow"></div>
        </section>
      </div>
    `;
  }
}
