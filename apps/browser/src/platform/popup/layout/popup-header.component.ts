import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  Signal,
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
  SvgModule,
  TypographyModule,
} from "@bitwarden/components";

import { PopupRouterCacheService } from "../view-cache/popup-router-cache.service";

import { PopupPageComponent } from "./popup-page.component";

@Component({
  selector: "popup-header",
  templateUrl: "popup-header.component.html",
  imports: [
    TypographyModule,
    CommonModule,
    IconButtonModule,
    JslibModule,
    AsyncActionsModule,
    SvgModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopupHeaderComponent {
  private readonly popupRouterCacheService = inject(PopupRouterCacheService);

  /**
   * Optional so that this temporary flag read doesn't force a `ConfigService` stub into every spec
   * that happens to render a page header. Always present in the running extension.
   */
  private readonly configService = inject(ConfigService, { optional: true });

  protected readonly pageContentScrolled: Signal<boolean> = inject(PopupPageComponent).isScrolled;

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

  /** Background color */
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

  /** Under VFO1 the title bar always sits on the page background; `background` only applies to v1. */
  protected readonly showAltBackground = computed(
    () => this.vfo1Enabled() || this.background() === "alt",
  );
}
