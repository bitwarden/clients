import { BehaviorSubject, distinctUntilChanged, map, Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CipherRiskService } from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherRiskResult } from "@bitwarden/sdk-internal";

import { CipherHealthView } from "../../../access-intelligence/models/view/cipher-health.view";
import { RiskCategory } from "../../models/risk-category";
import { VaultHealthReportView } from "../../models/view/vault-health-report.view";
import { VaultHealthReportService } from "../abstractions/vault-health-report.service";

/** The latest report together with the user it was built for. */
type ScopedReport = { userId: UserId; report: VaultHealthReportView };

export class DefaultVaultHealthReportService implements VaultHealthReportService {
  private readonly report = new BehaviorSubject<ScopedReport | null>(null);

  constructor(private cipherRiskService: CipherRiskService) {}

  /**
   * Filters the given ciphers to the personal-vault logins in scope, then
   * categorizes, deduplicates (highest-risk-wins), and scores them, publishing
   * the result to `getVaultHealthReport$`. The caller (the Health-tab root
   * component) owns fetching the vault ciphers and deciding when to recompute.
   * Errors from the risk computation propagate to the caller.
   */
  async buildVaultHealthReport(ciphers: CipherView[], userId: UserId): Promise<void> {
    const logins = this.filterScopedLogins(ciphers);
    const report = await this.buildReport(logins, userId);
    this.report.next({ userId, report });
  }

  /**
   * Get the latest vault health scan report for a user, run buildVaultHealthReport
   * first to generate the report.
   * @returns an observable that emits the latest report built for `userId`, or
   * null when no scan has run for that user
   */
  getVaultHealthReport$(userId: UserId): Observable<VaultHealthReportView | null> {
    return this.report.pipe(
      map((scoped) => (scoped?.userId === userId ? scoped.report : null)),
      distinctUntilChanged(),
    );
  }

  /**
   * Delete an item from an existing vault health report, without rebuilding the
   * report. Publishes a new report to `getVaultHealthReport$` with the item
   * removed and the counts and score adjusted.
   *
   * @param cipherId the id of the cipher/item to be deleted from the report
   * @param category the risk category the cipher/item belongs to
   * @param userId the id of the user deleting the item
   * @returns n/a
   */
  deleteItemFromReport(cipherId: string, category: RiskCategory, userId: UserId): void {
    const current = this.report.value;
    if (current?.userId !== userId) {
      return;
    }

    const { report } = current;
    const items = report.categoryItems[category].filter((item) => item.cipherId !== cipherId);
    if (items.length === report.categoryItems[category].length) {
      return;
    }

    const atRiskCount = report.atRiskCount - 1;
    const totalCount = report.totalCount - 1;

    this.report.next({
      userId,
      report: new VaultHealthReportView({
        ...report,
        atRiskCount,
        totalCount,
        score: totalCount === 0 ? 0 : atRiskCount / totalCount,
        categoryItems: { ...report.categoryItems, [category]: items },
      }),
    });
  }

  /**
   * Personal-vault logins with a password: Login type, no organization,
   * not deleted, non-empty password. A superset of the SDK's own predicate,
   * so every login passed to the risk service qualifies.
   */
  private filterScopedLogins(ciphers: CipherView[] | null): CipherView[] {
    return (ciphers ?? []).filter(
      (c) =>
        c.type === CipherType.Login &&
        c.organizationId == null &&
        !c.isDeleted &&
        (c.login?.password ?? "") !== "",
    );
  }

  private async buildReport(logins: CipherView[], userId: UserId): Promise<VaultHealthReportView> {
    const totalCount = logins.length;
    if (totalCount === 0) {
      return new VaultHealthReportView();
    }

    // Pre-build the reuse map so reuse_count is populated, then compute risk
    // with exposed (HIBP) checking enabled. Errors propagate to the caller.
    const passwordMap = await this.cipherRiskService.buildPasswordReuseMap(logins, userId);
    const risks = await this.cipherRiskService.computeRiskForCiphers(logins, userId, {
      passwordMap,
      checkExposed: true,
    });

    // Each CipherRiskResult carries its own `id`, so map results to per-login
    // views directly by id (no reliance on array position).
    const healthViews = risks.map((risk) => this.toCipherHealthView(risk));
    const atRisk = healthViews.filter((health) => health.isAtRisk());

    const categoryItems: Record<RiskCategory, CipherHealthView[]> = atRisk.reduce(
      (categories: Record<RiskCategory, CipherHealthView[]>, health) => {
        const category = this.highestRiskCategory(health);
        categories[category].push(health);
        return categories;
      },
      { exposed: [], weak: [], reused: [] },
    );

    return new VaultHealthReportView({
      totalCount,
      atRiskCount: atRisk.length,
      score: atRisk.length / totalCount,
      categoryItems,
    });
  }

  private toCipherHealthView(risk: CipherRiskResult): CipherHealthView {
    const exposedCount = risk.exposed_result.type === "Found" ? risk.exposed_result.value : 0;
    return new CipherHealthView({
      cipherId: String(risk.id),
      hasExposedPassword: exposedCount > 0,
      hasWeakPassword: risk.password_strength < 3,
      hasReusedPassword: (risk.reuse_count ?? 1) > 1,
      exposedCount,
      reuseCount: risk.reuse_count ?? 0,
      weakPasswordScore: risk.password_strength,
    });
  }

  /** Highest-risk-wins: Exposed > Weak > Reused. Only called for at-risk logins. */
  private highestRiskCategory(health: CipherHealthView): RiskCategory {
    if (health.hasExposedPassword) {
      return RiskCategory.Exposed;
    }
    if (health.hasWeakPassword) {
      return RiskCategory.Weak;
    }
    return RiskCategory.Reused;
  }
}
