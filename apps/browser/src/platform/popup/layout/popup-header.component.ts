import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
  linkedSignal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BitwardenLogo } from "@bitwarden/assets/svg";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  AsyncActionsModule,
  ButtonType,
  FunctionReturningAwaitable,
  IconButtonModule,
  ScrollLayoutService,
  scrollDirection,
  SvgModule,
  TypographyModule,
} from "@bitwarden/components";

import { PopupRouterCacheService } from "../view-cache/popup-router-cache.service";

import { PopupPageComponent } from "./popup-page.component";

@Component({
  selector: "popup-header",
  templateUrl: "popup-header.component.html",
  imports: [
    NgTemplateOutlet,
    TypographyModule,
    IconButtonModule,
    JslibModule,
    AsyncActionsModule,
    SvgModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopupHeaderComponent {
  private readonly popupRouterCacheService = inject(PopupRouterCacheService);
  private readonly scrollLayout = inject(ScrollLayoutService);

  /**
   * TODO: remove with the VFO1Foundation flag.
   *
   * Optional so that reading the flag doesn't force a `ConfigService` stub into every spec that
   * happens to render a page header. Always present in the running extension.
   */
  private readonly configService = inject(ConfigService, { optional: true });

  /**
   * TODO: remove with the VFO1Foundation flag.
   *
   * Optional so that a spec can render a bare `popup-header` without standing up the page it is
   * normally projected into.
   */
  private readonly page = inject(PopupPageComponent, { optional: true });

  /** TODO: remove with the VFO1Foundation flag. Renders the two-bar header. */
  protected readonly vfo1Enabled = toSignal(
    this.configService?.getFeatureFlag$(FeatureFlag.VFO1Foundation) ?? of(false),
    { initialValue: false },
  );

  protected readonly logo = BitwardenLogo;

  /**
   * Background treatment of the page title bar.
   *
   * - `"default"` sits on an opaque background with a bottom border
   * - `"alt"` is transparent and borderless, for pages that paint their own background
   */
  readonly background = input<"default" | "alt">("default");

  /** Display the back button, which uses Location.back() to go back one page in history */
  readonly showBackButton = input(false, { transform: booleanAttribute });

  /**
   * Hide the page title bar for pages that title themselves in their own content. The back button
   * moves into the app bar. VFO1 only — the one-bar header has no bar to fall back to.
   */
  readonly hideTitleBar = input(false, { transform: booleanAttribute });

  /** Title string that will be inserted as an h1 */
  readonly pageTitle = input.required<string>();

  /**
   * Async action that occurs when clicking the back button
   *
   * If unset, will call `location.back()`
   **/
  readonly backAction = input<FunctionReturningAwaitable>(async () => {
    return this.popupRouterCacheService.back();
  });

  /**
   * The popup viewport is short, so the title bar gets out of the way while the user reads down the
   * page. The app bar stays pinned.
   */
  private readonly scrollDirection = scrollDirection(this.scrollLayout.scrollableRef);

  /**
   * TODO: remove with the VFO1Foundation flag. Grows a border under an `alt` bar once the page
   * moves.
   */
  private readonly pageScrolled = computed(() => this.page?.isScrolled() ?? false);

  /** The title bar is gone for the life of the page, so the back button moves to the app bar. */
  protected readonly titleBarSuppressed = computed(() => this.vfo1Enabled() && this.hideTitleBar());

  /** The app bar sits on the nav background, which only `side-nav` is legible against. */
  protected readonly backButtonType = computed<ButtonType>(() =>
    this.titleBarSuppressed() ? "side-nav" : "primaryGhost",
  );

  /** Collapsed by scroll, unlike `titleBarSuppressed` — the bar is still there and focusable. */
  protected readonly titleBarHidden = computed(
    () => this.vfo1Enabled() && !this.hideTitleBar() && this.scrollDirection() === "down",
  );

  /**
   * The bar's own account of where it is, published on `data-state` so anything watching the bar
   * reads the state rather than inferring it from the classes that happen to implement it.
   */
  protected readonly titleBarState = computed(() => {
    if (this.titleBarSuppressed()) {
      return "suppressed";
    }

    return this.titleBarHidden() ? "collapsed" : "expanded";
  });

  /**
   * TODO: remove with the VFO1Foundation flag, along with the gate in `titleBarClasses`. Once the bar
   * is styled on its first render, the transition classes go back in the base list unconditionally —
   * an element never transitions on its first style resolution.
   *
   * True once the bar has collapsed at least once. `vfo1Enabled` resolves after the first paint, and
   * CSS transitions from the after-change style alone, so a transition declared in that pass animates
   * the arriving padding and border instead of a collapse.
   */
  private readonly titleBarAnimated = linkedSignal<boolean, boolean>({
    source: this.titleBarHidden,
    computation: (hidden, previous) => hidden || (previous?.value ?? false),
  });

  /**
   * TODO: remove with the VFO1Foundation flag, along with the `header` class binding it feeds.
   *
   * The one-bar header paints `header` itself rather than a descendant, which is what keeps it
   * reachable by the `[&_header]:` overrides the default password manager prompt relies on.
   */
  protected readonly headerClasses = computed(() => {
    if (this.vfo1Enabled()) {
      return "";
    }

    const classes = [
      "tw-py-3",
      "bit-compact:tw-py-2",
      // End padding is less than start padding to prioritize visual alignment when icon buttons are
      // used at the end of the `end` slot. Other elements used there may need their own margin or
      // padding to achieve visual alignment.
      "tw-pe-1",
      "bit-compact:tw-pe-0.5",
      "tw-transition-colors",
      "tw-duration-200",
      "tw-border-0",
      "tw-border-b",
      "tw-border-solid",
    ];

    if (this.background() === "alt" && !this.pageScrolled()) {
      classes.push("tw-bg-background-alt", "tw-border-transparent");
    } else {
      classes.push("tw-bg-background", "tw-border-border-base");
    }

    /** The back button's own padding stands in for the bar's start padding. */
    classes.push(
      ...(this.showBackButton()
        ? ["tw-ps-1", "bit-compact:tw-ps-0"]
        : ["tw-ps-4", "bit-compact:tw-ps-3"]),
    );

    return classes.join(" ");
  });

  protected readonly titleBarClasses = computed(() => {
    if (!this.vfo1Enabled()) {
      return "";
    }

    // `display: none` rather than an `@if`: destroying the bar would take the `end` slot's
    // projected content with it, since the same `ng-content` serves both bars.
    if (this.titleBarSuppressed()) {
      return "tw-hidden";
    }

    // The bar is a single-row grid, collapsed by animating that row between `1fr` and `0fr`. There
    // is no height ceiling to guess: the expanded bar is whatever height its content needs.
    const classes = [
      "tw-grid",
      "tw-overflow-hidden",
      "tw-border-0",
      "tw-border-b",
      "tw-border-solid",
    ];

    // TODO: remove with the VFO1Foundation flag — move these three back into the base list above.
    // See `titleBarAnimated`: declaring the transition before the bar collapses would animate the
    // padding and border that arrive with the flag rather than the collapse.
    if (this.titleBarAnimated()) {
      classes.push(
        "motion-safe:tw-transition-[grid-template-rows,padding]",
        "tw-duration-200",
        "tw-ease-out",
      );
    }

    // The transparent bar keeps the border box so both treatments collapse to the same height.
    classes.push(
      ...(this.background() === "alt"
        ? ["tw-bg-transparent", "tw-border-transparent"]
        : ["tw-bg-bg-tertiary", "tw-border-border-base"]),
    );

    /** The back button's own padding stands in for the title bar's start padding. */
    if (this.showBackButton()) {
      classes.push("tw-ps-1", "bit-compact:tw-ps-0");
    }

    if (this.titleBarHidden()) {
      // The block padding collapses alongside the row so visible motion starts on the first frame.
      // `focus-within` keeps the collapsed bar reachable, and visible, by Shift+Tab — its extra
      // pseudo-class outweighs the collapsed values, so no `!` is needed.
      classes.push(
        "tw-grid-rows-[0fr]",
        "tw-px-3",
        "bit-compact:tw-px-2",
        "tw-py-0",
        "focus-within:tw-grid-rows-[1fr]",
        "focus-within:tw-py-3",
        "bit-compact:focus-within:tw-py-2",
      );
    } else {
      classes.push("tw-grid-rows-[1fr]", "tw-p-3", "bit-compact:tw-p-2");
    }

    return classes.join(" ");
  });
}
