import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { map } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { HeaderComponent, BannerModule } from "@bitwarden/components";

import { AccountSwitcherV2Component } from "../../../auth/components/account-switcher/account-switcher-v2.component";

@Component({
  selector: "app-header",
  templateUrl: "./desktop-header.component.html",
  imports: [BannerModule, HeaderComponent, AccountSwitcherV2Component],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesktopHeaderComponent {
  private route = inject(ActivatedRoute);
  private i18nService = inject(I18nService);

  /**
   * Title to display in header (takes precedence over route data)
   */
  readonly title = input<string>();

  /**
   * Icon to show before the title
   */
  readonly icon = input<string>();

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
