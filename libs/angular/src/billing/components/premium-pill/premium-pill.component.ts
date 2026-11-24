import { ChangeDetectionStrategy, Component } from "@angular/core";

import { BadgeComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "app-premium-pill",
  template: `
    <span bitBadge variant="primary" size="small" startIcon="bwi-premium">
      {{ "premium" | i18n }}
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, I18nPipe],
})
export class PremiumPillComponent {}
