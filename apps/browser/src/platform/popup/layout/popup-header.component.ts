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
   * Renders the two-bar header: a branded app bar above the page title bar.
   *
   * Remove this along with the v1 branch of the template when the flag is retired.
   */
  protected readonly vfo1Enabled = toSignal(
    this.configService?.getFeatureFlag$(FeatureFlag.VFO1Foundation) ?? of(false),
    { initialValue: false },
  );

  protected readonly logo = BitwardenLogo;

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

  protected readonly titleBarHidden = computed(
    () => this.vfo1Enabled() && this.scrollDirection() === "down",
  );

  protected readonly titleBarClasses = computed(() => {
    /** The back button's own padding stands in for the title bar's start padding. */
    const classes = this.showBackButton() ? ["tw-ps-1", "bit-compact:tw-ps-0"] : [];

    if (this.titleBarHidden()) {
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
