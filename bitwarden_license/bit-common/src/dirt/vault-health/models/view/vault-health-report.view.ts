import { View } from "@bitwarden/common/models/view/view";

import { CipherHealthView } from "../../../access-intelligence/models/view/cipher-health.view";
import { RiskCategory } from "../risk-category";

type CategoryRecord<T> = Record<RiskCategory, T>;

/**
 * The aggregated, deduplicated, scored vault-health result for the browser
 * Health tab. Computed on demand from the per-login SDK risk metrics; not
 * persisted, so it is a View-only model (no Data/Domain/API siblings),
 * matching CipherHealthView.
 */
export class VaultHealthReportView implements View {
  /** Personal-vault logins with a password (the score denominator). */
  totalCount = 0;
  /** Unique logins at risk in any category (the score numerator). */
  atRiskCount = 0;
  /** atRiskCount / totalCount; 0 when totalCount is 0. */
  score = 0;
  /**
   * The at-risk logins placed in each category (highest-risk-wins). The
   * per-category count is the length of each list; no separate counts record
   * is kept. Each item is a CipherHealthView that carries every category the
   * login is at risk in, so consumers needing the cross-category view (e.g.
   * the delete-from-detail dialog) can read it here without a separate list.
   */
  categoryItems: CategoryRecord<CipherHealthView[]> = { exposed: [], weak: [], reused: [] };

  constructor(init?: Partial<VaultHealthReportView>) {
    if (init == null) {
      return;
    }
    Object.assign(this, init);
  }

  /**
   * Builds a report from the health of every scoped login, at risk or not: keeps
   * the at-risk ones, places each in its highest risk category, and scores them
   * against `totalCount`, which is passed in rather than derived from
   * `healthViews` so the denominator stays what the caller scoped.
   */
  static fromCipherHealth(
    healthViews: CipherHealthView[],
    totalCount: number,
  ): VaultHealthReportView {
    const atRisk = healthViews.filter((health) => health.isAtRisk());

    const categoryItems = atRisk.reduce<CategoryRecord<CipherHealthView[]>>(
      (categories, health) => {
        categories[highestRiskCategory(health)].push(health);
        return categories;
      },
      { exposed: [], weak: [], reused: [] },
    );

    return new VaultHealthReportView({
      totalCount,
      atRiskCount: atRisk.length,
      score: totalCount === 0 ? 0 : atRisk.length / totalCount,
      categoryItems,
    });
  }
}

/** Highest-risk-wins: Exposed > Weak > Reused. Only called for at-risk logins. */
function highestRiskCategory(health: CipherHealthView): RiskCategory {
  if (health.hasExposedPassword) {
    return RiskCategory.Exposed;
  }
  if (health.hasWeakPassword) {
    return RiskCategory.Weak;
  }
  return RiskCategory.Reused;
}
