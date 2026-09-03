import { BehaviorSubject, distinctUntilChanged, map, Observable } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherRiskService } from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherRiskResult } from "@bitwarden/sdk-internal";

import { CipherHealthView } from "../../../access-intelligence/models/view/cipher-health.view";
import {
  VAULT_HEALTH_REPORT_IDLE,
  VaultHealthReportState,
} from "../../models/vault-health-report-state";
import { VaultHealthReportStatus } from "../../models/vault-health-report-status";
import { VaultHealthReportView } from "../../models/view/vault-health-report.view";
import { VaultHealthReportService } from "../abstractions/vault-health-report.service";

/**
 * The scoped logins a report was built from: cipher id to revision. A revision
 * moves whenever a login is saved, so comparing fingerprints catches a password
 * change without holding the password. A rename moves it too, which costs a
 * rebuild but never a wrong report. Holds no password or risk data.
 */
type VaultFingerprint = Map<string, string>;

/**
 * The published state plus the fingerprint of the vault it came from. The
 * fingerprint is kept here rather than in its own map so it cannot drift out of
 * sync with the report it describes, and is stripped before publishing.
 */
type InternalState = VaultHealthReportState & { fingerprint: VaultFingerprint | null };

const INTERNAL_IDLE: InternalState = Object.freeze({
  ...VAULT_HEALTH_REPORT_IDLE,
  fingerprint: null,
});

export class DefaultVaultHealthReportService implements VaultHealthReportService {
  /**
   * One stream per user, so a build that resolves after the account switched
   * publishes into the user it belongs to and can't overwrite another. Dies with
   * the popup, so there is no eviction on logout. Overlapping builds for the same
   * user are the caller's concern: the last to resolve wins.
   */
  private readonly states = new Map<UserId, BehaviorSubject<InternalState>>();

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
    const { report: retained, fingerprint: retainedFingerprint } = state.value;
    state.next({
      status: VaultHealthReportStatus.Loading,
      report: retained,
      fingerprint: retainedFingerprint,
    });

    try {
      const logins = this.filterScopedLogins(ciphers);
      const report = await this.buildReport(logins, userId);
      state.next({
        status: VaultHealthReportStatus.Success,
        report,
        fingerprint: this.fingerprintOf(logins),
      });
    } catch (error) {
      // Logged here so a failed report is identifiable in a log dump no matter
      // who triggered it.
      this.logService.error("Vault health report generation failed", error);
      // The fingerprint is retained alongside the report so a failed scan leaves
      // the baseline a later refresh compares against intact.
      state.next({
        status: VaultHealthReportStatus.Error,
        report: retained,
        fingerprint: retainedFingerprint,
      });
    }
  }

  async refreshVaultHealthReport(ciphers: CipherView[], userId: UserId): Promise<void> {
    const state = this.stateFor(userId);
    const previous = state.value;

    // Nothing to bring up to date until a scan has published a report.
    if (previous.report == null || previous.fingerprint == null) {
      return;
    }

    // A scan already in flight will publish fresher results than this would, and
    // publishing over it would replace its progress view with a stale report.
    if (previous.status === VaultHealthReportStatus.Loading) {
      return;
    }

    const logins = this.filterScopedLogins(ciphers);
    const fingerprint = this.fingerprintOf(logins);
    if (this.sameFingerprint(previous.fingerprint, fingerprint)) {
      return;
    }

    try {
      const report = await this.buildReport(logins, userId);
      // A build that landed while this was in flight is newer; leave it alone.
      if (state.value !== previous) {
        return;
      }
      state.next({ status: VaultHealthReportStatus.Success, report, fingerprint });
    } catch (error) {
      // Deliberately publishes nothing: a refresh nobody asked for must not
      // replace results already on screen with a failure view. The fingerprint is
      // left un-advanced, so the next vault change retries this same work.
      this.logService.error("Vault health report refresh failed", error);
    }
  }

  /**
   * This user's stream, created on first use. Created on read too, so a
   * subscriber that arrives before any build still receives its publishes.
   */
  private stateFor(userId: UserId): BehaviorSubject<InternalState> {
    let state = this.states.get(userId);
    if (state == null) {
      state = new BehaviorSubject<InternalState>(INTERNAL_IDLE);
      this.states.set(userId, state);
    }
    return state;
  }

  /** The user's scan status and latest report; `idle` with no report until a build runs. */
  getVaultHealthReport$(userId: UserId): Observable<VaultHealthReportState> {
    return this.stateFor(userId).pipe(
      map(({ status, report }) => ({ status, report })),
      distinctUntilChanged((a, b) => a.status === b.status && a.report === b.report),
    );
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

  private fingerprintOf(logins: CipherView[]): VaultFingerprint {
    return new Map(
      logins.map((login) => [login.id, login.revisionDate?.toISOString() ?? ""] as const),
    );
  }

  private sameFingerprint(a: VaultFingerprint, b: VaultFingerprint): boolean {
    if (a.size !== b.size) {
      return false;
    }
    for (const [cipherId, revision] of a) {
      if (b.get(cipherId) !== revision) {
        return false;
      }
    }
    return true;
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
    return VaultHealthReportView.fromCipherHealth(
      risks.map((risk) => this.toCipherHealthView(risk)),
      totalCount,
    );
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
}
