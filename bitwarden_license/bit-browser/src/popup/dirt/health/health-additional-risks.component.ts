import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { CipherHealthView } from "@bitwarden/bit-common/dirt/access-intelligence/models/view/cipher-health.view";
import { RiskCategory } from "@bitwarden/bit-common/dirt/vault-health/models";
import {
  CardComponent,
  IconTileComponent,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** Lists the risks a login has below the category it is listed in. Renders nothing when there are none. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dirt-health-additional-risks",
  templateUrl: "./health-additional-risks.component.html",
  imports: [
    SectionComponent,
    SectionHeaderComponent,
    IconTileComponent,
    CardComponent,
    TypographyModule,
    I18nPipe,
  ],
})
export class HealthAdditionalRisksComponent {
  readonly item = input.required<CipherHealthView>();
  readonly currentCategory = input.required<RiskCategory>();

  protected readonly additionalRisks = computed<{ showWeak: boolean; showReused: boolean }>(() => {
    const item = this.item();
    // only show additional risk categories when the item currently being viewed also falls into lower risk categories
    switch (this.currentCategory()) {
      case RiskCategory.Exposed:
        return { showWeak: item.hasWeakPassword, showReused: item.hasReusedPassword };
      case RiskCategory.Weak:
        return { showWeak: false, showReused: item.hasReusedPassword };
      case RiskCategory.Reused:
      default:
        return { showWeak: false, showReused: false };
    }
  });
}
