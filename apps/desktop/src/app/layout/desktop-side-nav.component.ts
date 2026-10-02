import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { NavigationModule, SideNavService, SideNavVariant } from "@bitwarden/components";

import { AccountSwitcherV2Component } from "../../auth/components/account-switcher/account-switcher-v2.component";

@Component({
  selector: "app-side-nav",
  templateUrl: "desktop-side-nav.component.html",
  imports: [CommonModule, NavigationModule, AccountSwitcherV2Component],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesktopSideNavComponent {
  readonly variant = input<SideNavVariant>("primary");
  protected readonly sideNavService = inject(SideNavService);

  /**
   * Whether the side-nav footer account switcher should render. It replaces the legacy header
   * account switcher (see `DesktopHeaderComponent`) once VFO1 is enabled.
   */
  protected readonly vfo1FoundationEnabled = toSignal(
    inject(ConfigService).getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );
}
