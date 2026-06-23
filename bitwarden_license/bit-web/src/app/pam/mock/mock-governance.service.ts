import { Injectable } from "@angular/core";

import {
  BulkRevokeResult,
  GovernanceService,
  OrganizationGovernanceSummaryResponse,
} from "@bitwarden/bit-pam";

/**
 * One leasing-enabled collection in the governance demo. Mutable: the kill
 * switch zeroes `activeLeaseCount` so a subsequent dashboard load reflects the
 * org-wide revoke.
 */
interface GovernanceCollection {
  collectionId: string;
  collectionName: string;
  /** Access-rule conditions, in the wire shape `parseAccessConditions` expects. */
  conditions: Array<Record<string, unknown>>;
  /** Distinct members with access to this collection. */
  memberWithAccessCount: number;
  pendingRequestCount: number;
  activeLeaseCount: number;
  /** How long ago the row's last activity was, or null for none. */
  lastActivityMsAgo: number | null;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * DEMO ONLY — self-contained {@link GovernanceService} implementation backing
 * the PAM governance dashboard and kill switch, the only PAM surface with no
 * server implementation yet. `provide-pam.ts` binds it unconditionally until the
 * governance backend lands; every other PAM call goes to the real server.
 *
 * Holds hardcoded per-collection demo data (members, pending requests, active
 * leases) plus an in-memory org-wide leasing freeze. Singleton so the dashboard
 * and kill switch share one mutable view; resets on reload.
 */
@Injectable({ providedIn: "root" })
export class MockGovernanceService extends GovernanceService {
  private readonly collections: GovernanceCollection[] = [
    {
      collectionId: "mock-collection-prod-secrets",
      collectionName: "Production secrets",
      conditions: [{ kind: "human_approval" }],
      memberWithAccessCount: 12,
      pendingRequestCount: 3,
      activeLeaseCount: 2,
      lastActivityMsAgo: 8 * MINUTE_MS,
    },
    {
      collectionId: "mock-collection-infrastructure",
      collectionName: "Infrastructure",
      conditions: [
        { kind: "human_approval" },
        { kind: "ip_allowlist", cidrs: ["10.0.0.0/8", "192.168.0.0/16"] },
      ],
      memberWithAccessCount: 7,
      pendingRequestCount: 0,
      activeLeaseCount: 1,
      lastActivityMsAgo: 2 * HOUR_MS,
    },
    {
      collectionId: "mock-collection-monitoring",
      collectionName: "Monitoring",
      conditions: [{ kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] }],
      memberWithAccessCount: 18,
      pendingRequestCount: 1,
      activeLeaseCount: 0,
      lastActivityMsAgo: 5 * HOUR_MS,
    },
    {
      collectionId: "mock-collection-email-services",
      collectionName: "Email services",
      conditions: [{ kind: "human_approval" }],
      memberWithAccessCount: 4,
      pendingRequestCount: 0,
      activeLeaseCount: 0,
      lastActivityMsAgo: 2 * DAY_MS,
    },
    {
      collectionId: "mock-collection-finance",
      collectionName: "Finance",
      conditions: [],
      memberWithAccessCount: 3,
      pendingRequestCount: 0,
      activeLeaseCount: 0,
      lastActivityMsAgo: null,
    },
  ];

  /** Organizations currently under an org-wide leasing freeze (kill switch). */
  private readonly frozenOrgs = new Set<string>();

  /** Per-collection governance summary for the dashboard. */
  async getGovernanceSummary(
    organizationId: string,
  ): Promise<OrganizationGovernanceSummaryResponse> {
    const now = Date.now();
    return new OrganizationGovernanceSummaryResponse({
      OrganizationId: organizationId,
      LeasingEnabledCollectionCount: this.collections.length,
      TotalPendingRequestCount: this.collections.reduce((s, c) => s + c.pendingRequestCount, 0),
      TotalActiveLeaseCount: this.collections.reduce((s, c) => s + c.activeLeaseCount, 0),
      Collections: this.collections.map((c) => ({
        CollectionId: c.collectionId,
        CollectionName: c.collectionName,
        Conditions: c.conditions,
        MemberWithAccessCount: c.memberWithAccessCount,
        PendingRequestCount: c.pendingRequestCount,
        ActiveLeaseCount: c.activeLeaseCount,
        LastActivityAt:
          c.lastActivityMsAgo == null ? null : new Date(now - c.lastActivityMsAgo).toISOString(),
      })),
    });
  }

  /**
   * Org-wide kill switch: revoke every active lease (zeroing the demo rows so the
   * dashboard reflects it on the next load) and optionally engage a leasing
   * freeze that blocks new leases until {@link unblock}.
   */
  async bulkRevokeLeases(
    organizationId: string,
    blockNewLeases: boolean,
  ): Promise<BulkRevokeResult> {
    let revokedCount = 0;
    for (const collection of this.collections) {
      revokedCount += collection.activeLeaseCount;
      collection.activeLeaseCount = 0;
    }
    if (blockNewLeases) {
      this.frozenOrgs.add(organizationId);
    }
    return { kind: "ok", revokedCount };
  }

  /** Lift an org-wide leasing freeze, if one is engaged. */
  async unblockNewLeases(organizationId: string): Promise<void> {
    this.frozenOrgs.delete(organizationId);
  }

  /** Whether the organization currently has a leasing freeze engaged. */
  async isLeasingFrozen(organizationId: string): Promise<boolean> {
    return this.frozenOrgs.has(organizationId);
  }
}
