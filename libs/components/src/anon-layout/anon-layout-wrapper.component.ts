import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Data, NavigationEnd, Router, RouterModule } from "@angular/router";
import { filter, of, switchMap, tap } from "rxjs";

import { BitSvg } from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { Translation } from "../dialog";
import {
  ContentVerticalPaddingType,
  FooterVerticalPaddingType,
  HeroTextAlignmentType,
  LandingContentMaxWidthType,
} from "../landing-layout";

import { ANON_LAYOUT_DEFAULTS } from "./anon-layout-defaults";
import { AnonLayoutWrapperDataService } from "./anon-layout-wrapper-data.service";
import { AnonLayoutComponent, SecondaryContentLocationType } from "./anon-layout.component";
export interface AnonLayoutWrapperData {
  /**
   * The optional title of the page.
   * If a string is provided, it will be presented as is (ex: Organization name)
   * If a Translation object (supports placeholders) is provided, it will be translated
   */
  pageTitle?: string | Translation | null;
  /**
   * The optional subtitle of the page.
   * If a string is provided, it will be presented as is (ex: user's email)
   * If a Translation object (supports placeholders) is provided, it will be translated
   */
  pageSubtitle?: string | Translation | null;
  /**
   * The icon to display on the page. Pass null to hide the icon.
   *
   * Optional. The layout itself decides whether to render the icon based on `hidePageIcon`;
   * this field just supplies which icon to render when it is shown.
   */
  pageIcon?: BitSvg | null;
  /**
   * Whether to hide the page icon. Defaults to false (icon is shown).
   *
   * When true, the layout suppresses the icon even if `pageIcon` is set.
   */
  hidePageIcon?: boolean;
  /**
   * Vertical padding of the content area. Defaults to "default".
   *
   * "compact" reduces the vertical padding so more content fits. Use in scenarios where vertical space is at a premium.
   */
  contentVerticalPadding?: ContentVerticalPaddingType;
  /**
   * Vertical padding of the footer. Defaults to "default".
   *
   * "compact" reduces the vertical padding so more content fits. Use in scenarios where vertical space is at a premium.
   */
  footerVerticalPadding?: FooterVerticalPaddingType;
  /**
   * Horizontal alignment of the hero's title and subtitle. Defaults to "center".
   * (The icon is always centered. Pair with `hidePageIcon: true` for a fully
   * left-aligned hero block.)
   */
  heroTextAlignment?: HeroTextAlignmentType;
  /**
   * Optional flag to either show the optional environment selector (false) or just a readonly hostname (true).
   */
  showReadonlyHostname?: boolean;
  /**
   * Optional flag to set the max-width of the page. Defaults to 'md' if not provided.
   */
  maxWidth?: LandingContentMaxWidthType;
  /**
   * Hide the card that wraps the default content. Defaults to false.
   */
  hideCardWrapper?: boolean;
  /**
   * Hides the background illustration. Defaults to false.
   */
  hideBackgroundIllustration?: boolean;
  /**
   * Where to render content from the route's `outlet: "secondary"` router outlet. Defaults to "main".
   *
   * "main" places the secondary content beneath the main card.
   * "footer" places it inside the footer.
   */
  secondaryContentLocation?: SecondaryContentLocationType;
}

interface AnonLayoutWrapperState {
  pageTitle?: string | null;
  pageSubtitle?: string | null;
  pageIcon: BitSvg | null;
  showReadonlyHostname?: boolean | null;
  maxWidth?: LandingContentMaxWidthType | null;
  hideCardWrapper?: boolean | null;
  hideBackgroundIllustration?: boolean | null;
  hidePageIcon?: boolean;
  contentVerticalPadding?: ContentVerticalPaddingType;
  footerVerticalPadding?: FooterVerticalPaddingType;
  heroTextAlignment?: HeroTextAlignmentType;
  secondaryContentLocation?: SecondaryContentLocationType;
}

const EMPTY_STATE: AnonLayoutWrapperState = { pageIcon: null };

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "anon-layout-wrapper.component.html",
  imports: [AnonLayoutComponent, RouterModule],
})
export class AnonLayoutWrapperComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly i18nService = inject(I18nService);
  private readonly anonLayoutWrapperDataService = inject(AnonLayoutWrapperDataService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<AnonLayoutWrapperState>(EMPTY_STATE);

  ngOnInit(): void {
    // Set the initial page data on load
    this.setAnonLayoutWrapperDataFromRouteData(this.route.snapshot.firstChild?.data);
    // Listen for page changes and update the page data appropriately
    this.listenForPageDataChanges();
    this.listenForServiceDataChanges();
  }

  private listenForPageDataChanges() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        // reset page data on page changes
        tap(() => this.state.set(EMPTY_STATE)),
        switchMap(() => this.route.firstChild?.data || of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((firstChildRouteData: Data | null) => {
        this.setAnonLayoutWrapperDataFromRouteData(firstChildRouteData);
      });
  }

  private setAnonLayoutWrapperDataFromRouteData(firstChildRouteData?: Data | null) {
    if (!firstChildRouteData) {
      return;
    }

    const next: AnonLayoutWrapperState = { ...this.state() };

    if (firstChildRouteData["pageTitle"] !== undefined) {
      next.pageTitle = this.handleStringOrTranslation(firstChildRouteData["pageTitle"]);
    }

    if (firstChildRouteData["pageSubtitle"] !== undefined) {
      next.pageSubtitle = this.handleStringOrTranslation(firstChildRouteData["pageSubtitle"]);
    }

    if (firstChildRouteData["pageIcon"] !== undefined) {
      next.pageIcon = firstChildRouteData["pageIcon"];
    }

    // When undefined, fall back to ANON_LAYOUT_DEFAULTS — single source of truth for
    // route-init defaults, the reset emission, and the component-level input defaults.
    next.showReadonlyHostname =
      firstChildRouteData["showReadonlyHostname"] ?? ANON_LAYOUT_DEFAULTS.showReadonlyHostname;
    next.maxWidth = firstChildRouteData["maxWidth"] ?? ANON_LAYOUT_DEFAULTS.maxWidth;
    next.hideCardWrapper =
      firstChildRouteData["hideCardWrapper"] ?? ANON_LAYOUT_DEFAULTS.hideCardWrapper;
    next.hideBackgroundIllustration =
      firstChildRouteData["hideBackgroundIllustration"] ??
      ANON_LAYOUT_DEFAULTS.hideBackgroundIllustration;
    next.hidePageIcon = firstChildRouteData["hidePageIcon"] ?? ANON_LAYOUT_DEFAULTS.hidePageIcon;
    next.contentVerticalPadding =
      firstChildRouteData["contentVerticalPadding"] ?? ANON_LAYOUT_DEFAULTS.contentVerticalPadding;
    next.footerVerticalPadding =
      firstChildRouteData["footerVerticalPadding"] ?? ANON_LAYOUT_DEFAULTS.footerVerticalPadding;
    next.heroTextAlignment =
      firstChildRouteData["heroTextAlignment"] ?? ANON_LAYOUT_DEFAULTS.heroTextAlignment;
    next.secondaryContentLocation =
      firstChildRouteData["secondaryContentLocation"] ??
      ANON_LAYOUT_DEFAULTS.secondaryContentLocation;

    this.state.set(next);

    // Cache the route-data payload so resetToCachedRouteData() can later restore it.
    this.anonLayoutWrapperDataService.cacheRouteData(
      firstChildRouteData as Partial<AnonLayoutWrapperData>,
    );
  }

  private listenForServiceDataChanges() {
    this.anonLayoutWrapperDataService
      .anonLayoutWrapperData$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: Partial<AnonLayoutWrapperData>) => {
        this.setAnonLayoutWrapperDataFromService(data);
      });
  }

  private setAnonLayoutWrapperDataFromService(data: Partial<AnonLayoutWrapperData>) {
    if (!data) {
      return;
    }

    const next: AnonLayoutWrapperState = { ...this.state() };

    // Null emissions are used to reset the page data as all fields are optional.

    if (data.pageTitle !== undefined) {
      next.pageTitle =
        data.pageTitle !== null ? this.handleStringOrTranslation(data.pageTitle) : null;
    }

    if (data.pageSubtitle !== undefined) {
      next.pageSubtitle =
        data.pageSubtitle !== null ? this.handleStringOrTranslation(data.pageSubtitle) : null;
    }

    if (data.pageIcon !== undefined) {
      next.pageIcon = data.pageIcon !== null ? data.pageIcon : null;
    }

    if (data.showReadonlyHostname !== undefined) {
      next.showReadonlyHostname = data.showReadonlyHostname;
    }

    if (data.hideCardWrapper !== undefined) {
      next.hideCardWrapper = data.hideCardWrapper;
    }

    if (data.hideBackgroundIllustration !== undefined) {
      next.hideBackgroundIllustration = data.hideBackgroundIllustration;
    }
    if (data.maxWidth !== undefined) {
      next.maxWidth = data.maxWidth;
    }

    if (data.hidePageIcon !== undefined) {
      next.hidePageIcon = data.hidePageIcon;
    }
    if (data.contentVerticalPadding !== undefined) {
      next.contentVerticalPadding = data.contentVerticalPadding;
    }
    if (data.footerVerticalPadding !== undefined) {
      next.footerVerticalPadding = data.footerVerticalPadding;
    }
    if (data.heroTextAlignment !== undefined) {
      next.heroTextAlignment = data.heroTextAlignment;
    }
    if (data.secondaryContentLocation !== undefined) {
      next.secondaryContentLocation = data.secondaryContentLocation;
    }

    this.state.set(next);
  }

  private handleStringOrTranslation(value: string | Translation): string {
    if (typeof value === "string") {
      // If it's a string, return it as is
      return value;
    }

    // If it's a Translation object, translate it
    return this.i18nService.t(value.key, ...(value.placeholders ?? []));
  }
}
