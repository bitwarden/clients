import { css, html, PropertyValues } from "lit";
import { customElement, property, query, queryAll, state } from "lit/decorators.js";

import type { BadgeVariant, BitBadge } from "../badge/badge";
import "../badge/badge";
import "../chips/chip-action/chip-action";
import type { BitChipAction } from "../chips/chip-action/chip-action";
import { BitElement } from "../core/bit-element";
import { t } from "../core/i18n";
import { BitwardenIcon } from "../icon/shared-icon";
import { packOverflow } from "../overflow-list/pack";
import { attachPopoverTrigger, PopoverAnchorHandle } from "../popover/attach-popover";
import "../popover/popover-panel";
import type { BitPopoverPanel } from "../popover/popover-panel";

/** A single badge rendered by `bit-badge-group`. */
export type BadgeGroupItem = {
  /** Text shown inside the badge. */
  label: string;
  variant?: BadgeVariant;
  startIcon?: BitwardenIcon | null;
};

const GAP_PX = 8;

/**
 * Displays badges in a horizontal row that doesn't wrap. Badges that don't fit are hidden and a
 * "+N" chip opens a popover listing them. The first badge is always visible and truncates when
 * the container is too narrow even for it.
 *
 * Sizing is measurement-driven: resize the container and more or fewer badges become visible.
 */
@customElement("bit-badge-group")
export class BitBadgeGroup extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  @property({ type: Array }) badges: BadgeGroupItem[] = [];

  @state() private widths: number[] | null = null;
  @state() private triggerWidth = 0;
  @state() private containerWidth = 0;
  @state() private measuring = true;
  @state() private ready = false;

  @queryAll("bit-badge[data-item]") private itemEls!: NodeListOf<BitBadge>;
  @query("[data-trigger]") private triggerEl!: BitChipAction;
  @query("bit-popover-panel") private panel!: BitPopoverPanel;

  private resizeObserver = new ResizeObserver(([entry]) => {
    this.containerWidth = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
  });
  private measureQueued = false;
  private overflowPopover?: PopoverAnchorHandle;

  connectedCallback() {
    super.connectedCallback();
    this.resizeObserver.observe(this);
    if (this.hasUpdated && !this.overflowPopover) {
      this.overflowPopover = attachPopoverTrigger(this.triggerEl, this.panel);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver.disconnect();
    this.overflowPopover?.destroy();
    this.overflowPopover = undefined;
  }

  protected firstUpdated() {
    this.overflowPopover = attachPopoverTrigger(this.triggerEl, this.panel);
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has("badges")) {
      this.widths = null;
      this.measuring = true;
      void this.measure();
    }
  }

  private async measure() {
    if (this.measureQueued) {
      return;
    }
    this.measureQueued = true;
    await this.updateComplete;
    await (document.fonts?.ready ?? Promise.resolve());
    // Badges inside the group are rendered too; their widths depend on their own render.
    await Promise.all(Array.from(this.itemEls, (el) => el.updateComplete));
    this.measureQueued = false;
    this.widths = Array.from(this.itemEls, (el) => Math.ceil(el.getBoundingClientRect().width));
    this.triggerWidth = this.triggerEl
      ? Math.ceil(this.triggerEl.getBoundingClientRect().width)
      : 0;
    this.measuring = false;
    this.ready = true;
  }

  private get packed() {
    const count = this.badges.length;
    if (this.measuring || !this.widths || this.widths.length !== count) {
      return { displayed: this.badges.map((_, i) => i), overflow: [] as number[] };
    }
    return packOverflow(this.widths, this.containerWidth, {
      gap: GAP_PX,
      triggerWidth: this.triggerWidth,
      pinIndex: 0,
    });
  }

  render() {
    const { displayed, overflow } = this.packed;
    const overflowSet = new Set(overflow);
    const sole = displayed.length === 1 ? displayed[0] : -1;
    const triggerHidden = this.ready && !this.measuring && overflow.length === 0;
    const overflowBadges = overflow.map((i) => this.badges[i]).filter(Boolean);

    return html`
      <div class="tw-flex ${this.ready ? "" : "tw-invisible"}" style="gap: ${GAP_PX}px">
        ${this.badges.map(
          (badge, i) =>
            html`<bit-badge
                data-item
                variant=${badge.variant ?? "primary"}
                .startIcon=${badge.startIcon}
                class=${
                  !this.measuring && i === sole
                    ? "tw-flex-initial tw-min-w-0 tw-overflow-hidden"
                    : "tw-shrink-0"
                }
                ?hidden=${overflowSet.has(i)}
                >${badge.label}</bit-badge
              ><span class="tw-sr-only" ?hidden=${overflowSet.has(i)}>,</span>`,
        )}
        <bit-chip-action
          data-trigger
          variant="subtle"
          label="+${overflow.length}"
          accessible-name=${t("showMoreCount", overflow.length)}
          class="tw-shrink-0"
          ?hidden=${this.badges.length === 0 || triggerHidden}
        ></bit-chip-action>
      </div>
      <bit-popover-panel padding="compact" accessible-name=${t("showMore")}>
        <div class="tw-flex tw-flex-col tw-items-start tw-gap-2">
          ${overflowBadges.map(
            (badge) =>
              html`<bit-badge variant=${badge.variant ?? "primary"} .startIcon=${badge.startIcon}
                  >${badge.label}</bit-badge
                ><span class="tw-sr-only">,</span>`,
          )}
        </div>
      </bit-popover-panel>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-badge-group": BitBadgeGroup;
  }
}
