import { ContextProvider } from "@lit/context";
import { css, html, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { BitSvg } from "@bitwarden/assets/svg";

import { BitElement } from "../core/bit-element";
import { onTranslatorChange, t } from "../core/i18n";
import type { Translation } from "../dialog/simple-dialog-types";
import type { LandingLayoutClientType } from "../landing-layout/landing-layout";

import { ANON_LAYOUT_DEFAULTS } from "./anon-layout-defaults";
import {
  AnonLayoutWrapperData,
  anonLayoutWrapperDataContext,
  AnonLayoutWrapperDataService,
  DefaultAnonLayoutWrapperDataService,
} from "./anon-layout-wrapper-data";
import "./anon-layout";

type WrapperState = Omit<AnonLayoutWrapperData, "pageTitle" | "pageSubtitle"> & {
  pageTitle?: string | Translation | null;
  pageSubtitle?: string | Translation | null;
  pageIcon: BitSvg | null;
};

const FORWARDED_SLOTS = ["header-actions", "secondary", "environment-selector"];

const EMPTY_STATE: WrapperState = { pageIcon: null };

const FIELDS = [
  "pageTitle",
  "pageSubtitle",
  "pageIcon",
  "showReadonlyHostname",
  "maxWidth",
  "hideCardWrapper",
  "hideBackgroundIllustration",
  "hidePageIcon",
  "contentVerticalPadding",
  "footerVerticalPadding",
  "heroTextAlignment",
  "secondaryContentLocation",
] as const;

/** Fields that fall back to `ANON_LAYOUT_DEFAULTS` when the page data omits them. */
const DEFAULTED = FIELDS.filter(
  (field) => field !== "pageTitle" && field !== "pageSubtitle" && field !== "pageIcon",
);

/**
 * Feeds per-page data into `bit-anon-layout`. Replaces the router-driven
 * `AnonLayoutWrapperComponent`: the app sets `routeData` whenever the page changes (e.g. from its
 * router's route data) and slots the page's content, and content can override the data at runtime
 * through the `AnonLayoutWrapperDataService` it requests via `anonLayoutWrapperDataContext`.
 *
 * Slots are passed through to `bit-anon-layout` (`header-actions`, `secondary`,
 * `environment-selector`); `secondary` content follows `secondaryContentLocation`.
 */
@customElement("bit-anon-layout-wrapper")
export class BitAnonLayoutWrapper extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
        height: 100%;
      }
    `,
  ];

  /**
   * The current page's data. Setting it resets anything content set through the data service, the
   * way a navigation does in Angular. Translations are resolved with `t()`.
   */
  @property({ attribute: false }) routeData?: AnonLayoutWrapperData;

  /** Service content uses to override the page data. One is created per wrapper by default. */
  @property({ attribute: false }) dataService: AnonLayoutWrapperDataService =
    new DefaultAnonLayoutWrapperDataService();

  /** Passed to `bit-anon-layout`. */
  @property() hostname?: string;

  /** Passed to `bit-anon-layout`. */
  @property() version?: string;

  /** Passed to `bit-anon-layout`. */
  @property({ attribute: "client-type" }) clientType: LandingLayoutClientType = "web";

  @state() private state: WrapperState = EMPTY_STATE;
  @state() private filled = new Set<string>();

  private readonly observer = new MutationObserver(() => this.detectSlots());

  private readonly provider = new ContextProvider(
    this,
    anonLayoutWrapperDataContext,
    this.dataService,
  );
  private unsubscribe?: () => void;
  private stopTranslator?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this.subscribeToService();
    this.stopTranslator = onTranslatorChange(() => this.requestUpdate());
    this.detectSlots();
    this.observer.observe(this, { childList: true, subtree: true, attributeFilter: ["slot"] });
  }

  // Forwarded only when filled, so bit-anon-layout can tell empty slots apart.
  private detectSlots() {
    const filled = new Set(
      FORWARDED_SLOTS.filter((name) => this.querySelector(`:scope > [slot="${name}"]`)),
    );
    if ([...filled].join() !== [...this.filled].join()) {
      this.filled = filled;
    }
  }

  private forward(name: string) {
    return this.filled.has(name) ? html`<slot name=${name} slot=${name}></slot>` : nothing;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.stopTranslator?.();
    this.observer.disconnect();
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has("dataService")) {
      this.provider.setValue(this.dataService, true);
      this.subscribeToService();
    }
    if (changed.has("routeData")) {
      // Reset page data on page changes.
      this.state = EMPTY_STATE;
      this.applyRouteData(this.routeData);
    }
  }

  private subscribeToService() {
    this.unsubscribe?.();
    this.unsubscribe = this.isConnected
      ? this.dataService.subscribe((data) => this.applyServiceData(data))
      : undefined;
  }

  private applyRouteData(data?: AnonLayoutWrapperData) {
    if (!data) {
      return;
    }
    const next: WrapperState = { ...this.state };
    if (data.pageTitle !== undefined) {
      next.pageTitle = data.pageTitle;
    }
    if (data.pageSubtitle !== undefined) {
      next.pageSubtitle = data.pageSubtitle;
    }
    if (data.pageIcon !== undefined) {
      next.pageIcon = data.pageIcon;
    }
    // When undefined, fall back to ANON_LAYOUT_DEFAULTS — the single source of truth for page
    // defaults, the reset emission, and the layout's property defaults.
    for (const field of DEFAULTED) {
      (next as Record<string, unknown>)[field] = data[field] ?? ANON_LAYOUT_DEFAULTS[field];
    }
    this.state = next;
    // Cache the page payload so resetToCachedRouteData() can later restore it.
    this.dataService.cacheRouteData(data);
  }

  /** `undefined` fields are ignored; `null` resets a field (all fields are optional). */
  private applyServiceData(data: Partial<AnonLayoutWrapperData>) {
    if (!data) {
      return;
    }
    const next: Record<string, unknown> = { ...this.state };
    for (const field of FIELDS) {
      if (data[field] !== undefined) {
        next[field] = data[field];
      }
    }
    this.state = next as WrapperState;
  }

  private resolveText(value?: string | Translation | null): string | undefined {
    if (value == null) {
      return undefined;
    }
    return typeof value === "string" ? value : t(value.key, ...(value.placeholders ?? []));
  }

  render() {
    const state = this.state;
    return html`<bit-anon-layout
      .pageTitle=${this.resolveText(state.pageTitle)}
      .pageSubtitle=${this.resolveText(state.pageSubtitle)}
      .icon=${state.pageIcon}
      .showReadonlyHostname=${state.showReadonlyHostname ?? ANON_LAYOUT_DEFAULTS.showReadonlyHostname}
      .maxWidth=${state.maxWidth ?? ANON_LAYOUT_DEFAULTS.maxWidth}
      .hideCardWrapper=${state.hideCardWrapper ?? ANON_LAYOUT_DEFAULTS.hideCardWrapper}
      .hideBackgroundIllustration=${
        state.hideBackgroundIllustration ?? ANON_LAYOUT_DEFAULTS.hideBackgroundIllustration
      }
      .hidePageIcon=${state.hidePageIcon ?? ANON_LAYOUT_DEFAULTS.hidePageIcon}
      .contentVerticalPadding=${
        state.contentVerticalPadding ?? ANON_LAYOUT_DEFAULTS.contentVerticalPadding
      }
      .footerVerticalPadding=${
        state.footerVerticalPadding ?? ANON_LAYOUT_DEFAULTS.footerVerticalPadding
      }
      .heroTextAlignment=${state.heroTextAlignment ?? ANON_LAYOUT_DEFAULTS.heroTextAlignment}
      .secondaryContentLocation=${
        state.secondaryContentLocation ?? ANON_LAYOUT_DEFAULTS.secondaryContentLocation
      }
      .hostname=${this.hostname}
      .version=${this.version}
      .clientType=${this.clientType}
    >
      ${this.forward("header-actions")}
      <slot></slot>
      ${this.forward("secondary")} ${this.forward("environment-selector")}
    </bit-anon-layout>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-anon-layout-wrapper": BitAnonLayoutWrapper;
  }
}
