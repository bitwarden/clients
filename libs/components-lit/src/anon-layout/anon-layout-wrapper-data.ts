import { createContext } from "@lit/context";

import type { BitSvg } from "@bitwarden/assets/svg";

import type { Translation } from "../dialog/simple-dialog-types";
import type {
  ContentVerticalPaddingType,
  LandingContentMaxWidthType,
} from "../landing-layout/landing-content";
import type { FooterVerticalPaddingType } from "../landing-layout/landing-footer";
import type { HeroTextAlignmentType } from "../landing-layout/landing-hero";

import { ANON_LAYOUT_DEFAULTS } from "./anon-layout-defaults";

export type SecondaryContentLocationType = "main" | "footer";

export interface AnonLayoutWrapperData {
  /**
   * The optional title of the page. A string is presented as is (e.g. an organization name); a
   * `Translation` is translated with `t()`.
   */
  pageTitle?: string | Translation | null;
  /**
   * The optional subtitle of the page. A string is presented as is (e.g. the user's email); a
   * `Translation` is translated with `t()`.
   */
  pageSubtitle?: string | Translation | null;
  /** The icon to display on the page. `hidePageIcon` decides whether it is shown. */
  pageIcon?: BitSvg | null;
  /** Whether to hide the page icon even if `pageIcon` is set. Defaults to false. */
  hidePageIcon?: boolean;
  /** Vertical padding of the content area. "compact" fits more content. Defaults to "default". */
  contentVerticalPadding?: ContentVerticalPaddingType;
  /** Vertical padding of the footer. "compact" fits more content. Defaults to "default". */
  footerVerticalPadding?: FooterVerticalPaddingType;
  /**
   * Horizontal alignment of the hero's title and subtitle. Defaults to "center". (The icon is always
   * centered. Pair with `hidePageIcon: true` for a fully left-aligned hero block.)
   */
  heroTextAlignment?: HeroTextAlignmentType;
  /** Show a readonly hostname (true) instead of the environment selector (false). */
  showReadonlyHostname?: boolean;
  /** The max-width of the page. Defaults to 'md'. */
  maxWidth?: LandingContentMaxWidthType;
  /** Hide the card that wraps the default content. Defaults to false. */
  hideCardWrapper?: boolean;
  /** Hides the background illustration. Defaults to false. */
  hideBackgroundIllustration?: boolean;
  /**
   * Where to render `slot="secondary"` content. "main" places it beneath the main card, "footer"
   * inside the footer. Defaults to "main".
   */
  secondaryContentLocation?: SecondaryContentLocationType;
}

/**
 * Lets content inside a `bit-anon-layout-wrapper` override the page data the app supplied, and
 * dynamically control what the layout shows. Replaces the Angular `AnonLayoutWrapperDataService`
 * (Observables become `subscribe`).
 */
export interface AnonLayoutWrapperDataService {
  /** Sets data on the wrapper. `undefined` fields are ignored; `null` clears a field. */
  setAnonLayoutWrapperData(data: Partial<AnonLayoutWrapperData>): void;

  /** Receives every `setAnonLayoutWrapperData` payload. Returns an unsubscribe function. */
  subscribe(listener: (data: Partial<AnonLayoutWrapperData>) => void): () => void;

  /**
   * Caches the route-data payload so `resetToCachedRouteData()` can later restore it. Called by
   * the wrapper when the app sets `routeData`. Does not emit.
   */
  cacheRouteData(data: Partial<AnonLayoutWrapperData>): void;

  /**
   * Re-emits the cached route-data payload, undoing later imperative overrides, with defaults for
   * any fields the route omitted.
   */
  resetToCachedRouteData(): void;
}

export class DefaultAnonLayoutWrapperDataService implements AnonLayoutWrapperDataService {
  protected readonly listeners = new Set<(data: Partial<AnonLayoutWrapperData>) => void>();
  protected cachedRouteData: Partial<AnonLayoutWrapperData> = {};

  setAnonLayoutWrapperData(data: Partial<AnonLayoutWrapperData>): void {
    this.listeners.forEach((listener) => listener(data));
  }

  subscribe(listener: (data: Partial<AnonLayoutWrapperData>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  cacheRouteData(data: Partial<AnonLayoutWrapperData>): void {
    this.cachedRouteData = data;
  }

  resetToCachedRouteData(): void {
    // Defaults first so the payload is complete: route-declared fields win where present; unset
    // fields fall back to the defaults, clearing stale imperative overrides.
    this.setAnonLayoutWrapperData({ ...ANON_LAYOUT_DEFAULTS, ...this.cachedRouteData });
  }
}

/** Provided by `bit-anon-layout-wrapper` to its content. */
export const anonLayoutWrapperDataContext = createContext<AnonLayoutWrapperDataService>(
  Symbol("bit-anon-layout-wrapper-data"),
);
