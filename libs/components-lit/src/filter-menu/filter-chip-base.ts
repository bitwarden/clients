import { ContextConsumer } from "@lit/context";
import { html, nothing, PropertyValues } from "lit";
import { property } from "lit/decorators.js";

import { AriaTargetHost } from "../core/aria";
import { BitElement } from "../core/bit-element";
import type { BitwardenIcon } from "../icon/shared-icon";

import { FilterChipSize, filterChipHostStyles } from "./chip-styles";
import { FilterControl, FilterHost, filterHostContext } from "./filter-model";

/** Id of the hidden element describing the trigger with the disabled reason. */
export const DISABLED_REASON_ID = "disabled-reason";

/**
 * Shared behavior for `bit-filter-menu` and `bit-filter-toggle`: chip inputs, host registration,
 * state subscriptions and the `filterChange` event.
 *
 * @internal
 */
export abstract class BitFilterChipBase
  extends BitElement
  implements FilterControl, AriaTargetHost
{
  static styles = [BitElement.styles, filterChipHostStyles];

  /** The chip's key — the property its value occupies in a filter host's values. */
  @property() key = "";

  /** Leading icon, shown on the chip and beside the filter's row in the responsive dialog. */
  @property() icon?: BitwardenIcon;

  /** Keeps the chip focusable while blocking interaction (`aria-disabled`). */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /**
   * Explains why the chip is disabled. The chip carries no tooltip otherwise, so this is the only
   * one it shows, and only while `disabled`; it also becomes the trigger's accessible description.
   * Pass an already-localized string.
   */
  @property({ attribute: "disabled-tooltip" }) disabledTooltip = "";

  @property({ reflect: true }) size: FilterChipSize = "large";

  /** Stretch to the container's width. Otherwise capped by `--bit-filter-chip-max-width` (13rem). */
  @property({ type: Boolean, reflect: true, attribute: "full-width" }) fullWidth = false;

  abstract readonly value: unknown;
  abstract readonly clearedValue: unknown;
  abstract readonly active: boolean;
  abstract setValue(value: unknown): void;
  abstract readonly ariaTarget: HTMLElement | null;

  private readonly listeners = new Set<() => void>();
  private registeredHost?: FilterHost;

  protected readonly hostConsumer = new ContextConsumer(
    this,
    filterHostContext,
    (host) => {
      if (host === this.registeredHost) {
        return;
      }
      this.registeredHost?.unregisterFilter(this);
      this.registeredHost = host;
      // Registered once `key` and the selection mode have rendered: the host seeds off them.
      void this.updateComplete.then(() => {
        if (this.registeredHost === host) {
          host.registerFilter(this);
        }
      });
    },
    true,
  );

  /** The filterable surface this chip is in, if any. */
  protected get filterHost(): FilterHost | undefined {
    return this.hostConsumer.value;
  }

  /** Whether {@link disabledTooltip} is in play: the chip is disabled and has a reason. */
  protected get showDisabledReason(): boolean {
    return this.disabled && this.disabledTooltip.length > 0;
  }

  /** The trigger's only tooltip: the disabled reason. The label is already its accessible name. */
  protected get triggerTooltip(): string {
    return this.showDisabledReason ? this.disabledTooltip : "";
  }

  /**
   * The disabled reason as the trigger's description. Rendered in the chip's own shadow root:
   * a described-by tooltip attached during the first render lands outside it.
   */
  protected renderDisabledReason() {
    return this.showDisabledReason
      ? html`<span id=${DISABLED_REASON_ID} hidden>${this.disabledTooltip}</span>`
      : nothing;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.registeredHost?.unregisterFilter(this);
    this.registeredHost = undefined;
  }

  protected updated(changed: PropertyValues<this>) {
    super.updated(changed);
    this.listeners.forEach((listener) => listener());
  }

  protected emitChange() {
    this.dispatchEvent(
      new CustomEvent("filterChange", {
        detail: { key: this.key, value: this.value },
        bubbles: true,
        composed: true,
      }),
    );
  }
}
