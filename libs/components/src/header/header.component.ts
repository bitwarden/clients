import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { safeProvider } from "@bitwarden/ui-common";

import { IconComponent } from "../icon";
import { BitwardenIcon } from "../shared/icon";
import { TypographyDirective } from "../typography/typography.directive";

import { HeaderContext } from "./header-context";

/**
 * TODO
 * - secondary text content
 * - layout & header padding / sizes (responsiveness)
 * - update mdx pages for breadcrumbs, header, page, layout
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
})
export class HeaderComponent {
  private readonly configService = inject(ConfigService);

  private readonly headerContext = inject(HeaderContext);

  /**
   * The title of the page
   */
  readonly title = input.required<string>();

  /**
   * Icon to show before the title
   */
  readonly icon = input<BitwardenIcon>();

  protected readonly vfo1Enabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: true },
  );

  /** Whether a projected `bit-breadcrumbs` has taken over rendering the page's `<h1>`. */
  protected readonly hasActiveBreadcrumb = computed(() => this.headerContext.hasActiveBreadcrumb());

  // remove when VFO1 flag is removed
  constructor() {
    effect(() => {
      this.headerContext.shouldPromoteActiveBreadcrumb.set(this.vfo1Enabled());
    });
  }
}
