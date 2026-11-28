import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";

import { RiskCategory, VaultHealthReportView } from "@bitwarden/common/dirt/vault-health/models";
import {
  BitwardenIcon,
  ButtonModule,
  CardComponent,
  IconTileVariant,
  ItemModule,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AtRiskGaugeComponent } from "../at-risk-gauge/at-risk-gauge.component";
import { RiskCategoryNavItemComponent } from "../risk-category-nav-item/risk-category-nav-item.component";

// Order matches the report service's highest-risk-wins priority: Exposed, Weak, Reused.

const RISK_CATEGORY_ROWS: readonly {
  category: RiskCategory;
  labelKeyNone: string;
  labelKeySingular: string;
  labelKeyPlural: string;
  descriptionKey: string;
  descriptionKeyNone: string;
  icon: BitwardenIcon;
  variant: IconTileVariant;
  route: string;
}[] = [
  {
    category: RiskCategory.Exposed,
    labelKeyNone: "exposedPasswordsNone",
    labelKeySingular: "exposedPassword",
    labelKeyPlural: "exposedPasswordsPlural",
    descriptionKey: "exposedPasswordsDesc",
    descriptionKeyNone: "exposedPasswordsNoneDesc",
    icon: "bwi-error",
    variant: "danger",
    route: "/health/exposed",
  },
  {
    category: RiskCategory.Weak,
    labelKeyNone: "weakPasswordsNone",
    labelKeySingular: "weakPassword",
    labelKeyPlural: "weakPasswordsPlural",
    descriptionKey: "weakPasswordsDesc",
    descriptionKeyNone: "weakPasswordsNoneDesc",
    icon: "bwi-warning",
    variant: "warning",
    route: "/health/weak",
  },
  {
    category: RiskCategory.Reused,
    labelKeyNone: "reusedPasswordsNone",
    labelKeySingular: "reusedPassword",
    labelKeyPlural: "reusedPasswordsPlural",
    descriptionKey: "reusedPasswordsDesc",
    descriptionKeyNone: "reusedPasswordsNoneDesc",
    icon: "bwi-refresh",
    variant: "primary",
    route: "/health/reused",
  },
];

/** Health tab body for a completed scan; free users see the same result with the categories locked. */
@Component({
  selector: "dirt-health-overview",
  templateUrl: "./health-overview.component.html",
  imports: [
    AtRiskGaugeComponent,
    RiskCategoryNavItemComponent,
    ButtonModule,
    CardComponent,
    ItemModule,
    SectionHeaderComponent,
    TypographyModule,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HealthOverviewComponent {
  readonly report = input.required<VaultHealthReportView>();

  readonly locked = input(false);

  readonly upgrade = output<void>();

  protected readonly atRiskCount = computed(() => this.report().atRiskCount);

  protected readonly totalCount = computed(() => this.report().totalCount);

  protected readonly isAtRisk = computed(() => this.atRiskCount() > 0);

  protected readonly categoryRows = computed(() => {
    const categoryItems = this.report().categoryItems;
    return RISK_CATEGORY_ROWS.map((row) => ({
      ...row,
      count: categoryItems[row.category].length,
    }));
  });
}
