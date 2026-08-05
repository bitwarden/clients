import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { catchError, of, switchMap, take } from "rxjs";

import { RiskCategory } from "@bitwarden/bit-common/dirt/vault-health/models";
import { VaultHealthReportService } from "@bitwarden/bit-common/dirt/vault-health/services";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  BitwardenIcon,
  IconTileVariant,
  ItemModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AtRiskGaugeComponent } from "../shared/at-risk-gauge/at-risk-gauge.component";

import { RiskCategoryItemComponent } from "./risk-category-item.component";

/**
 * How each risk category renders, in the fixed order the overview shows them.
 * The order is the highest-risk-wins priority the report service applies:
 * Exposed, then Weak, then Reused.
 */
const RISK_CATEGORY_ROWS: readonly {
  category: RiskCategory;
  labelKey: string;
  descriptionKey: string;
  icon: BitwardenIcon;
  variant: IconTileVariant;
  route: string;
}[] = [
  {
    category: RiskCategory.Exposed,
    labelKey: "exposedPasswords",
    descriptionKey: "exposedPasswordsDesc",
    icon: "bwi-error",
    variant: "danger",
    route: "/health/exposed",
  },
  {
    category: RiskCategory.Weak,
    labelKey: "weakPasswords",
    descriptionKey: "weakPasswordsDesc",
    icon: "bwi-warning",
    variant: "warning",
    route: "/health/weak",
  },
  {
    category: RiskCategory.Reused,
    labelKey: "reusedPasswords",
    descriptionKey: "reusedPasswordsDesc",
    icon: "bwi-refresh",
    variant: "primary",
    route: "/health/reused",
  },
];

/**
 * The body of the Health tab for a premium user: the At-Risk Gauge with its
 * heading and count, and the three risk categories.
 *
 * Renders the vault-health report produced by {@link VaultHealthReportService},
 * which owns the categorization, highest-risk-wins deduplication, and score.
 */
@Component({
  selector: "dirt-health-overview",
  templateUrl: "./health-overview.component.html",
  imports: [
    AtRiskGaugeComponent,
    RiskCategoryItemComponent,
    ItemModule,
    TypographyModule,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HealthOverviewComponent {
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly vaultHealthReportService = inject(VaultHealthReportService);
  private readonly logService = inject(LogService);

  /**
   * The latest scan's result, or null while it is still running or after it
   * failed.
   *
   * Read through a single `toSignal`, so there is exactly one subscription no
   * matter how many times the template reads it. Keep it that way: splitting
   * this into multiple `toSignal` calls would open one subscription each and
   * repeat the breach lookup.
   *
   * TODO(PM-39223): the scan trigger, its progress view, and its failure state
   * move to the Health tab's scan story. Until then this runs the scan once per
   * Health tab open — the agreed cadence, with no caching and no manual rescan
   * — and takes only the first cipher emission so an expensive breach lookup is
   * not re-run on every vault change.
   */
  private readonly report = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.cipherService.cipherViews$(userId).pipe(
          take(1),
          switchMap((ciphers) =>
            this.vaultHealthReportService.buildVaultHealthReport$(ciphers, userId),
          ),
        ),
      ),
      catchError((error: unknown) => {
        this.logService.error(error);
        return of(null);
      }),
    ),
    { initialValue: null },
  );

  /** True once a scan result is available to render. */
  protected readonly hasReport = computed(() => this.report() != null);

  /** Unique logins at risk in any category — the gauge's value. */
  protected readonly atRiskCount = computed(() => this.report()?.atRiskCount ?? 0);

  /** Personal-vault logins with a password — the gauge's total. */
  protected readonly totalCount = computed(() => this.report()?.totalCount ?? 0);

  /** Drives the heading and the count line; the gauge derives its own colour. */
  protected readonly isAtRisk = computed(() => this.atRiskCount() > 0);

  /**
   * The three categories in fixed order, each with its deduplicated count.
   * Always three entries — a category with no at-risk items shows zero rather
   * than disappearing.
   */
  protected readonly categoryRows = computed(() => {
    const categoryItems = this.report()?.categoryItems;
    return RISK_CATEGORY_ROWS.map((row) => ({
      ...row,
      count: categoryItems?.[row.category].length ?? 0,
    }));
  });
}
