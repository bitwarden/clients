import { ChangeDetectionStrategy, Component } from "@angular/core";

import { PAM_OFFLINE_BANNER_KEY } from "@bitwarden/bit-pam";
import { CalloutModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { injectPamOffline } from "./pam-offline";

/**
 * The one notice shown while PAM actions are unavailable. Renders nothing while online, and never
 * on a client that provides no `PamConnectivityService`.
 */
@Component({
  selector: "app-pam-offline-banner",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalloutModule, I18nPipe],
  host: { class: "tw-block" },
  template: `
    <div role="status" aria-live="polite">
      @if (offline()) {
        <bit-callout
          type="warning"
          [title]="null"
          [accessibleName]="bannerKey | i18n"
          data-testid="pam-offline-banner"
        >
          {{ bannerKey | i18n }}
        </bit-callout>
      }
    </div>
  `,
})
export class PamOfflineBannerComponent {
  protected readonly offline = injectPamOffline();
  protected readonly bannerKey = PAM_OFFLINE_BANNER_KEY;
}
