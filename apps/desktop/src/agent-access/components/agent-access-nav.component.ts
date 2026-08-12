import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, map } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { NavigationModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";

/**
 * Sidebar nav item for the Agent Access page. Self-gated (rather than gated by the parent layout)
 * on both the `DesktopAgentAccess` feature flag and the user's `agentAccessEnabled` setting, so it
 * only appears once the feature is actually usable.
 */
@Component({
  selector: "app-agent-access-nav",
  template: `
    @if (showNav()) {
      <bit-nav-item icon="bwi-wireless" [text]="'agentAccess' | i18n" route="agent-access" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NavigationModule, I18nPipe],
})
export class AgentAccessNavComponent {
  private readonly configService = inject(ConfigService);
  private readonly desktopSettingsService = inject(DesktopSettingsService);

  protected readonly showNav = toSignal(
    combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.DesktopAgentAccess),
      this.desktopSettingsService.agentAccessEnabled$,
    ]).pipe(map(([flag, enabled]) => flag && enabled)),
    { initialValue: false },
  );
}
