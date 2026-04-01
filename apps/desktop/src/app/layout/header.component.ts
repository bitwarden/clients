import { Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-header",
  templateUrl: "header.component.html",
  standalone: false,
})
export class HeaderComponent {
  private configService: ConfigService = inject(ConfigService);

  protected readonly useNewAccountSwitcher = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.DesktopUiMigrationMilestone4),
    { initialValue: false },
  );
}
