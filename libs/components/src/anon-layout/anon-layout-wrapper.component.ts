import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Data, NavigationEnd, Router, RouterModule } from "@angular/router";
import { Subject, filter, of, switchMap } from "rxjs";

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

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "anon-layout-wrapper.component.html",
  imports: [AnonLayoutComponent, RouterModule],
})
export class AnonLayoutWrapperComponent implements OnInit {
  private destroy$ = new Subject<void>();

  protected pageTitle?: string | null;
  protected pageSubtitle?: string | null;
  protected pageIcon: BitSvg | null = null;
  protected showReadonlyHostname?: boolean;
  protected maxWidth?: LandingContentMaxWidthType;
  protected hideCardWrapper?: boolean;
  protected hideBackgroundIllustration?: boolean;
  protected hidePageIcon?: boolean;
  protected contentVerticalPadding?: ContentVerticalPaddingType;
  protected footerVerticalPadding?: FooterVerticalPaddingType;
  protected heroTextAlignment?: HeroTextAlignmentType;
  protected secondaryContentLocation?: SecondaryContentLocationType;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private i18nService: I18nService,
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,
    private changeDetectorRef: ChangeDetectorRef,
  ) {}

  private readonly destroyRef = inject(DestroyRef);

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

    const routeData = firstChildRouteData as Partial<AnonLayoutWrapperData>;

    // When undefined, fall back to ANON_LAYOUT_DEFAULTS — single source of truth for
    // route-init defaults, the reset emission, and the component-level input defaults.
    this.pageTitle = this.handleStringOrTranslation(
      routeData.pageTitle ?? ANON_LAYOUT_DEFAULTS.pageTitle,
    );
    this.pageSubtitle = this.handleStringOrTranslation(
      routeData.pageSubtitle ?? ANON_LAYOUT_DEFAULTS.pageSubtitle,
    );
    this.pageIcon = routeData.pageIcon ?? ANON_LAYOUT_DEFAULTS.pageIcon;

    this.showReadonlyHostname =
      routeData.showReadonlyHostname ?? ANON_LAYOUT_DEFAULTS.showReadonlyHostname;
    this.maxWidth = routeData.maxWidth ?? ANON_LAYOUT_DEFAULTS.maxWidth;
    this.hideCardWrapper = routeData.hideCardWrapper ?? ANON_LAYOUT_DEFAULTS.hideCardWrapper;
    this.hideBackgroundIllustration =
      routeData.hideBackgroundIllustration ?? ANON_LAYOUT_DEFAULTS.hideBackgroundIllustration;
    this.hidePageIcon = routeData.hidePageIcon ?? ANON_LAYOUT_DEFAULTS.hidePageIcon;
    this.contentVerticalPadding =
      routeData.contentVerticalPadding ?? ANON_LAYOUT_DEFAULTS.contentVerticalPadding;
    this.footerVerticalPadding =
      routeData.footerVerticalPadding ?? ANON_LAYOUT_DEFAULTS.footerVerticalPadding;
    this.heroTextAlignment = routeData.heroTextAlignment ?? ANON_LAYOUT_DEFAULTS.heroTextAlignment;
    this.secondaryContentLocation =
      routeData.secondaryContentLocation ?? ANON_LAYOUT_DEFAULTS.secondaryContentLocation;

    // Cache the route-data payload so resetToCachedRouteData() can later restore it.
    this.anonLayoutWrapperDataService.cacheRouteData(routeData);
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

    // Null emissions are used to reset the page data as all fields are optional.

    if (data.pageTitle !== undefined) {
      this.pageTitle = this.handleStringOrTranslation(data.pageTitle);
    }

    if (data.pageSubtitle !== undefined) {
      this.pageSubtitle = this.handleStringOrTranslation(data.pageSubtitle);
    }

    if (data.pageIcon !== undefined) {
      this.pageIcon = data.pageIcon;
    }

    if (data.showReadonlyHostname !== undefined) {
      this.showReadonlyHostname = data.showReadonlyHostname;
    }

    if (data.hideCardWrapper !== undefined) {
      this.hideCardWrapper = data.hideCardWrapper;
    }

    if (data.hideBackgroundIllustration !== undefined) {
      this.hideBackgroundIllustration = data.hideBackgroundIllustration;
    }
    if (data.maxWidth !== undefined) {
      this.maxWidth = data.maxWidth;
    }

    if (data.hidePageIcon !== undefined) {
      this.hidePageIcon = data.hidePageIcon;
    }
    if (data.contentVerticalPadding !== undefined) {
      this.contentVerticalPadding = data.contentVerticalPadding;
    }
    if (data.footerVerticalPadding !== undefined) {
      this.footerVerticalPadding = data.footerVerticalPadding;
    }
    if (data.heroTextAlignment !== undefined) {
      this.heroTextAlignment = data.heroTextAlignment;
    }
    if (data.secondaryContentLocation !== undefined) {
      this.secondaryContentLocation = data.secondaryContentLocation;
    }

    // Manually fire change detection to avoid ExpressionChangedAfterItHasBeenCheckedError
    // when setting the page data from a service
    this.changeDetectorRef.detectChanges();
  }

  private handleStringOrTranslation(value: string | Translation | null | undefined): string | null {
    if (value == null) {
      return null;
    }

    if (typeof value === "string") {
      return value;
    }

    return this.i18nService.t(value.key, ...(value.placeholders ?? []));
  }
}
