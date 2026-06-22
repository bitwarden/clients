import { AsyncPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { of } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { BadgeModule, NavigationModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { PamInboxBadgeService } from "../pam-inbox-badge.service";

/**
 * Renders the PAM approver-inbox entry in the user-layout side nav, including
 * the badge count, when the {@link FeatureFlag.Pam} feature flag is on.
 *
 * Encapsulates the flag lookup and the badge-count subscription so the host
 * layout can plug PAM in with a single tag and no PAM-specific symbols.
 */
@Component({
  selector: "app-pam-user-nav-slot",
  templateUrl: "./pam-user-nav-slot.component.html",
  imports: [AsyncPipe, BadgeModule, I18nPipe, NavigationModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PamUserNavSlotComponent {
  protected readonly pamEnabled$ = inject(ConfigService).getFeatureFlag$(FeatureFlag.Pam);
  protected readonly pamInboxBadgeCount = toSignal(
    inject(PamInboxBadgeService, { optional: true })?.count$ ?? of(0),
    { initialValue: 0 },
  );
}
