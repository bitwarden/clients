import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BitwardenLogo } from "@bitwarden/assets/svg";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  AsyncActionsModule,
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
   * Optional so that this temporary flag read doesn't force a `ConfigService` stub into every spec
   * that happens to render a page header. Always present in the running extension.
   */
  private readonly configService = inject(ConfigService, { optional: true });

  /**
   * Optional for the same reason as `ConfigService`: a spec can render a bare `popup-header` without
   * standing up the page it is normally projected into. Only the v1 header reads it.
   */
  private readonly page = inject(PopupPageComponent, { optional: true });

  /**
   * Renders the two-bar header: a branded app bar above the page title bar.
   *
   * Remove this along with the v1 branch of the template when the flag is retired.
   */
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
   *
   * Not gated by the flag: a page that owns its background owns it in either header.
   */
  readonly background = input<"default" | "alt">("default");

  /** Display the back button, which uses Location.back() to go back one page in history */
  readonly showBackButton = input(false, { transform: booleanAttribute });

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

  /** Only the v1 header uses this, to grow a border under an `alt` bar once the page moves. */
  private readonly pageScrolled = computed(() => this.page?.isScrolled() ?? false);

  protected readonly titleBarHidden = computed(
    () => this.vfo1Enabled() && this.scrollDirection() === "down",
  );

  /**
   * With the flag on, the two bars each paint themselves and `header` is a bare landmark. With the
   * flag off there is only one bar, so `header` paints it — which also keeps it reachable by the
   * `[&_header]:` overrides that pages such as the default password manager prompt rely on.
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
      classes.push("tw-bg-background", "tw-border-secondary-300");
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

    const classes = [
      "tw-p-3",
      "bit-compact:tw-p-2",
      // `tw-max-h-24` is a ceiling above the bar's natural height, not a fixed size — collapsing
      // animates `max-height` so the expanded bar keeps whatever height its content needs.
      "tw-max-h-24",
      "tw-overflow-hidden",
      "tw-border-0",
      "tw-border-b",
      "tw-border-solid",
      "motion-safe:tw-transition-all",
      "tw-duration-200",
      "tw-ease-out",
    ];

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
      // The padding collapses alongside the height so visible motion starts on the first frame.
      // `focus-within` keeps the collapsed bar reachable, and visible, by Shift+Tab.
      // `!` is required on both max-heights: Tailwind emits `tw-max-h-24` after `tw-max-h-0`, so at
      // equal specificity the static ceiling would otherwise win and the bar would never collapse.
      classes.push(
        "!tw-max-h-0",
        "!tw-py-0",
        "focus-within:!tw-max-h-24",
        "focus-within:!tw-py-3",
        "bit-compact:focus-within:!tw-py-2",
      );
    }

    return classes.join(" ");
  });
}
