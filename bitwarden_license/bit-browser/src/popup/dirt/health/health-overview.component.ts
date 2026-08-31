import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";

import {
  RiskCategory,
  VaultHealthReportView,
} from "@bitwarden/bit-common/dirt/vault-health/models";
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

import { AtRiskGaugeComponent } from "../shared/at-risk-gauge/at-risk-gauge.component";

import { RiskCategoryNavItemComponent } from "./risk-category-nav-item.component";

/**
 * How each risk category renders, in the fixed order the overview shows them.
 * The order is the highest-risk-wins priority the report service applies:
 * Exposed, then Weak, then Reused.
 */
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

/**
 * The body of the Health tab: the At-Risk Gauge with its heading and count, and
 * the three risk categories. Free users see the same scan result with the
 * categories locked.
 *
 * Presentational — it renders the report it is given and fetches nothing. The
 * Health tab root runs the scan and owns the subscription check.
 */
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
  /** The completed scan result to render. The Health tab root owns the scan. */
  readonly report = input.required<VaultHealthReportView>();

  /** Whether Health details are locked behind Premium. */
  readonly locked = input(false);

  /** The locked-state upgrade button was pressed. The Health tab root launches the flow. */
  readonly upgrade = output<void>();

  /** Unique logins at risk in any category — the gauge's value. */
  protected readonly atRiskCount = computed(() => this.report().atRiskCount);

  /** Personal-vault logins with a password — the gauge's total. */
  protected readonly totalCount = computed(() => this.report().totalCount);

  /** Drives the heading; the gauge derives its own colour. */
  protected readonly isAtRisk = computed(() => this.atRiskCount() > 0);

  /**
   * The three categories in fixed order, each with its deduplicated count.
   * Always three entries — a category with no at-risk items shows zero rather
   * than disappearing.
   */
  protected readonly categoryRows = computed(() => {
    const categoryItems = this.report().categoryItems;
    return RISK_CATEGORY_ROWS.map((row) => ({
      ...row,
      count: categoryItems[row.category].length,
    }));
  });
}
