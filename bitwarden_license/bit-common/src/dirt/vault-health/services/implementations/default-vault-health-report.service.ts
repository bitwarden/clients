import { BehaviorSubject, distinctUntilChanged, Observable } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherRiskService } from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherRiskResult } from "@bitwarden/sdk-internal";

import { CipherHealthView } from "../../../access-intelligence/models/view/cipher-health.view";
import { RiskCategory } from "../../models/risk-category";
import {
  VAULT_HEALTH_REPORT_IDLE,
  VaultHealthReportState,
} from "../../models/vault-health-report-state";
import { VaultHealthReportStatus } from "../../models/vault-health-report-status";
import { VaultHealthReportView } from "../../models/view/vault-health-report.view";
import { VaultHealthReportService } from "../abstractions/vault-health-report.service";

export class DefaultVaultHealthReportService implements VaultHealthReportService {
  /**
   * One stream per user, so a build that resolves after the account switched
   * publishes into the user it belongs to and can't overwrite another. Dies with
   * the popup. Overlapping builds for the same user are the caller's concern: the
   * last to resolve wins.
   */
  private readonly states = new Map<UserId, BehaviorSubject<VaultHealthReportState>>();

  constructor(
    private cipherRiskService: CipherRiskService,
    private logService: LogService,
  ) {}

  /**
   * Filters to the personal-vault logins in scope, scores them, and publishes
   * the report. Emits `loading`, then `success` or `error` (a failure is a
   * published status, not a thrown error).
   */
  async buildVaultHealthReport(ciphers: CipherView[], userId: UserId): Promise<void> {
    const state = this.stateFor(userId);
    const retained = state.value.report;
    state.next({ status: VaultHealthReportStatus.Loading, report: retained });

    try {
      const logins = this.filterScopedLogins(ciphers);
      const report = await this.buildReport(logins, userId);
      state.next({ status: VaultHealthReportStatus.Success, report });
    } catch (error) {
      // Logged here so a failed report is identifiable in a log dump no matter
      // who triggered it.
      this.logService.error("Vault health report generation failed", error);
      state.next({ status: VaultHealthReportStatus.Error, report: retained });
    }
  }

  /**
   * This user's stream, created on first use. Created on read too, so a
   * subscriber that arrives before any build still receives its publishes.
   */
  private stateFor(userId: UserId): BehaviorSubject<VaultHealthReportState> {
    let state = this.states.get(userId);
    if (state == null) {
      state = new BehaviorSubject<VaultHealthReportState>(VAULT_HEALTH_REPORT_IDLE);
      this.states.set(userId, state);
    }
    return state;
  }

  /** The user's scan status and latest report; `idle` with no report until a build runs. */
  getVaultHealthReport$(userId: UserId): Observable<VaultHealthReportState> {
    return this.stateFor(userId).pipe(
      distinctUntilChanged((a, b) => a.status === b.status && a.report === b.report),
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
    const state = this.stateFor(userId);
    // Nothing to remove from until a report has been built for this user.
    if (state.value.report == null) {
      return;
    }

    const report = state.value.report;
    const items = report.categoryItems[category].filter((item) => item.cipherId !== cipherId);
    if (items.length === report.categoryItems[category].length) {
      return;
    }

    const atRiskCount = report.atRiskCount - 1;
    const totalCount = report.totalCount - 1;

    const updated = new VaultHealthReportView({
      ...report,
      atRiskCount,
      totalCount,
      score: totalCount === 0 ? 0 : atRiskCount / totalCount,
      categoryItems: { ...report.categoryItems, [category]: items },
    });

    state.next({ status: VaultHealthReportStatus.Success, report: updated });
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
    // with exposed (HIBP) checking enabled. Failures here are caught by
    // buildVaultHealthReport and published as error state.
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
