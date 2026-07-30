import { Observable, from } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CipherRiskService } from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherRiskResult } from "@bitwarden/sdk-internal";

import { CipherHealthView } from "../../../access-intelligence/models/view/cipher-health.view";
import { RiskCategory } from "../../models/risk-category";
import { VaultHealthReportView } from "../../models/view/vault-health-report.view";
import { VaultHealthReportService } from "../abstractions/vault-health-report.service";

export class DefaultVaultHealthReportService implements VaultHealthReportService {
  constructor(private cipherRiskService: CipherRiskService) {}

  /**
   * Compute-only: the caller (the Health-tab root component) owns fetching the
   * vault ciphers and deciding when to recompute. This service filters the
   * given ciphers to the personal-vault logins in scope, then categorizes,
   * deduplicates (highest-risk-wins), and scores them. Errors from the risk
   * computation propagate to the caller.
   */
  buildVaultHealthReport$(
    ciphers: CipherView[],
    userId: UserId,
  ): Observable<VaultHealthReportView> {
    const logins = this.filterScopedLogins(ciphers);
    return from(this.buildReport(logins, userId));
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

    const categoryItems: Record<RiskCategory, CipherHealthView[]> = {
      exposed: [],
      weak: [],
      reused: [],
    };

    for (const health of atRisk) {
      const category = this.highestRiskCategory(health);
      categoryItems[category].push(health);
    }

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
