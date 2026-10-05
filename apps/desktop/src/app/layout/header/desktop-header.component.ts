import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { map } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { HeaderComponent, BannerModule, HeaderContext, BitwardenIcon } from "@bitwarden/components";
import { safeProvider } from "@bitwarden/ui-common";

import { AccountSwitcherV2Component } from "../../../auth/components/account-switcher/account-switcher-v2.component";

@Component({
  selector: "app-header",
  templateUrl: "./desktop-header.component.html",
  imports: [BannerModule, HeaderComponent, AccountSwitcherV2Component],
  changeDetection: ChangeDetectionStrategy.OnPush,
  /**
   * Required to provide one HeaderContext instance to both the `bit-breadrumbs` declared in this
   * template and the `bit-header`
   */
  providers: [safeProvider(HeaderContext)],
})
export class DesktopHeaderComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly i18nService = inject(I18nService);

  /**
   * Whether the VFO1 Foundation flag is enabled. Once enabled, the legacy header account
   * switcher is hidden in favor of the side-nav footer account switcher (see
   * `DesktopSideNavComponent`).
   */
  protected readonly vfo1FoundationEnabled = toSignal(
    inject(ConfigService).getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  /**
   * Title to display in header (takes precedence over route data)
   */
  readonly title = input<string>();

  /**
   * Icon to show before the title
   */
  readonly icon = input<BitwardenIcon>();

  private readonly routeData = toSignal(
    this.route.data.pipe(
      map((params) => ({
        titleId: params["pageTitle"]?.["key"] as string | undefined,
      })),
    ),
    { initialValue: { titleId: undefined } },
  );

  protected readonly resolvedTitle = computed(() => {
    const directTitle = this.title();
    if (directTitle) {
      return directTitle;
    }

    const titleId = this.routeData().titleId;
    return titleId ? this.i18nService.t(titleId) : "";
  });
}
