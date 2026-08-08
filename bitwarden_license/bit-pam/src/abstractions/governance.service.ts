import { BulkRevokeResult } from "./responses/bulk-revoke.result";
import { OrganizationGovernanceSummaryResponse } from "./responses/governance-summary.response";

/**
 * PAM governance surface — the org-admin dashboard and kill switch.
 *
 * Split out from {@link PamApiService} because it has no server implementation
 * yet (the default impl rejects) and is mocked independently of the rest of PAM.
 * The web `provide-pam.ts` binds this to the mock or the default at DI time; the
 * governance UI injects this rather than `PamApiService`.
 */
export abstract class GovernanceService {
  /** Per-collection governance summary powering the dashboard. */
  abstract getGovernanceSummary(
    organizationId: string,
  ): Promise<OrganizationGovernanceSummaryResponse>;
  /**
   * Org-wide kill switch: revokes all active leases in the organization. When
   * `blockNewLeases` is true, it also engages a leasing freeze so no new lease
   * can be activated until {@link unblockNewLeases} lifts it.
   */
  abstract bulkRevokeLeases(
    organizationId: string,
    blockNewLeases: boolean,
  ): Promise<BulkRevokeResult>;
  /** Lifts an org-wide leasing freeze so approved requests can be activated again. */
  abstract unblockNewLeases(organizationId: string): Promise<void>;
  /** Whether the organization is currently under a leasing freeze. */
  abstract isLeasingFrozen(organizationId: string): Promise<boolean>;
}
