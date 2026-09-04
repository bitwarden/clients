import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { of } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { safeProvider } from "@bitwarden/ui-common";

import { IconComponent } from "../icon";
import { BitwardenIcon } from "../shared/icon";
import { TypographyDirective } from "../typography/typography.directive";

import { HeaderContext } from "./header-context";

/**
 * The header displays a page's title, an optional icon, and the controls and navigation that belong
 * to that page. It renders the page's `<h1>`, so a page should contain exactly one header — unless a
 * projected `bit-breadcrumbs` promotes its active breadcrumb to the heading instead.
 *
 * Clients typically wrap `bit-header` in their own header component (`app-header` in web,
 * `app-desktop-header` in desktop) and project content through it rather than using `bit-header`
 * directly.
 */
@Component({
  selector: "bit-header",
  templateUrl: "./header.component.html",
  imports: [TypographyDirective, IconComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    /**
     * Support two composition usages:
     * 1. `bit-breadcrumbs` declared directly inside of `bit-header`: use `new HeaderContext`
     * 2. `bit-breadcrumbs` declared inside of a wrapper around `bit-header` (such as `app-header`):
     * `skipSelf` finds the wrapper's `HeaderContext` and uses that (since that is what the
     * breadcrumbs will use from DI)
     */
    safeProvider({
      provide: HeaderContext,
      useFactory: () =>
        inject(HeaderContext, { skipSelf: true, optional: true }) ?? new HeaderContext(),
      deps: [],
    }),
  ],
  host: {
    class: "tw-@container tw-block",
  },
})
export class HeaderComponent {
  private readonly configService = inject(ConfigService, { optional: true });

  private readonly headerContext = inject(HeaderContext);

  /**
   * The title of the page
   */
  readonly title = input.required<string>();

  /**
   * Icon to show before the title
   */
  readonly icon = input<BitwardenIcon>();

  // remove when VFO1 flag is removed
  protected readonly vfo1Enabled = toSignal(
    this.configService?.getFeatureFlag$(FeatureFlag.VFO1Foundation) ?? of(false),
    { initialValue: false },
  );

  /** Whether a projected `bit-breadcrumbs` has taken over rendering the page's `<h1>`. */
  protected readonly hasPromotedHeading = this.headerContext.hasPromotedHeading;
}
