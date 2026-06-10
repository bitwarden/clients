import { Injectable } from "@angular/core";
import { firstValueFrom, map, Observable, startWith } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import {
  BulkRevokeResult,
  CipherAccessState,
  DefaultPamApiService,
  GatedCipherFetchResult,
  AccessRequestDetailsResponse,
  AccessDecisionRequest,
  AccessEventService,
  AccessLeaseExtensionRequest,
  AccessRequestPatchRequest,
  AccessLeaseResponse,
  AccessLeaseRevokeRequest,
  OrganizationGovernanceSummaryResponse,
} from "@bitwarden/pam";

import { PamMockBuilders, PamMockStore } from "./pam-mock-store";

/**
 * DEMO ONLY — extends `DefaultPamApiService` and overrides the lease/request
 * surface with a {@link PamMockStore}-backed implementation. Access-rule CRUD
 * and any other method not overridden here falls through to the real server.
 *
 * Stateful in-memory: a click on a gated cipher creates a pending request whose
 * auto-decision (approve / deny, deterministic per request id) fires once the
 * Request Access modal is submitted. Approval issues a activatable *approved request* — no
 * lease exists until the requester activates it via {@link activateLease}.
 */
@Injectable({ providedIn: "root" })
export class MockPamApiService extends DefaultPamApiService {
  /**
   * Cached one-shot promise for the inbox seed. Cleared on failure so a
   * subsequent call retries (e.g. after the vault unlocks). Sharing the
   * promise across concurrent callers avoids the empty-store race that a
   * boolean flag would expose between flip-and-await.
   */
  private inboxSeedPromise: Promise<void> | null = null;

  constructor(
    private readonly store: PamMockStore,
    private readonly cipherService: CipherService,
    private readonly accountService: AccountService,
    apiService: ApiService,
    accessEvents: AccessEventService,
  ) {
    super(apiService, accessEvents);
    // The overridden mutation methods below bypass the base class's
    // localRefresh$ pumps, so bridge the store's event stream (which also
    // covers timer-driven auto-decisions) into the inherited mutations$.
    this.store.events$.subscribe(() => this.localRefresh$.next());
  }

  /**
   * Seeds the inbox exactly once using real vault cipher IDs so that the
   * "View in vault" links resolve correctly. Falls back to fake IDs if the
   * vault is empty or the user is not yet authenticated.
   */
  private ensureInboxSeeded(): Promise<void> {
    this.inboxSeedPromise ??= (async () => {
      try {
        const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
        const ciphers = await firstValueFrom(this.cipherService.cipherViews$(userId));
        this.store.seedInboxIfNeeded(ciphers?.map((c) => c.id) ?? []);
      } catch {
        // Not authenticated yet or vault locked — drop the cached promise so
        // the next call (after sign-in / unlock) re-attempts with real IDs.
        // Intentionally don't pre-seed with fake IDs here; the store's
        // idempotency guard would then prevent the retry from ever picking
        // up real cipher IDs.
        this.inboxSeedPromise = null;
      }
    })();
    return this.inboxSeedPromise;
  }

  getCipherAccessState$(cipherId: string, _userId: string): Observable<CipherAccessState> {
    const snapshot = (): CipherAccessState => {
      const activeLease = this.store.leasesByCipher.get(cipherId);
      const requests = [...this.store.requests.values()];
      const pendingRequest = requests.find(
        (r) => r.cipherId === cipherId && r.status === "pending",
      );
      // An approved-but-not-yet-activated request → the banner offers "Start access".
      const approvedRequest = requests.find(
        (r) => r.cipherId === cipherId && r.status === "approved" && r.extensionOfLeaseId == null,
      );
      return {
        activeLease: activeLease?.status === "active" ? activeLease : undefined,
        pendingRequest,
        approvedRequest,
      };
    };

    // Read path is side-effect free: the badge only reflects leases/requests
    // that exist because the user explicitly went through the request flow.

    // Re-emit on any lease event so the banner reflects approvals/denials/etc.
    return this.store.events$.pipe(
      map(() => snapshot()),
      startWith(snapshot()),
    );
  }

  async fetchGatedCipher(id: string): Promise<GatedCipherFetchResult> {
    const userId = this.store.currentUserId ?? "demo-user";
    // Settle any lapsed leases/approved requests before deciding the open outcome.
    this.store.sweepExpiries();
    // Ciphers in the "active" bucket lazily seed their lease on first open, so a
    // returning user lands straight on the active-lease banner. No-ops for the
    // other buckets and is idempotent.
    this.store.ensureSeedLease(id, userId);
    const existingLease = this.store.leasesByCipher.get(id);
    if (existingLease && existingLease.status === "active") {
      return {
        kind: "approved",
        // The interceptor drops cipher and only forwards leaseId; a minimal
        // stub satisfies the type without faking server-side decryption.
        cipher: new CipherResponse({}),
        leaseId: existingLease.id,
      };
    }
    const ownRequests = [...this.store.requests.values()].filter(
      (r) => r.cipherId === id && r.requesterId === userId,
    );
    // An approved-but-not-yet-activated request → offer to start the lease rather than
    // creating a duplicate request (CipherOpenAwaitingActivation).
    const approvedRequest = ownRequests.find(
      (r) => r.status === "approved" && r.extensionOfLeaseId == null,
    );
    if (approvedRequest) {
      return { kind: "awaiting_activation", request: approvedRequest };
    }
    // A request already in flight → return it rather than minting a second one.
    const pending = ownRequests.find((r) => r.status === "pending");
    if (pending) {
      return { kind: "pending", request: pending };
    }
    // Otherwise create a fresh on-demand pending request and surface the Request
    // Access modal. The user explicitly confirms via the modal — see
    // `patchAccessRequest`, which kicks off the mock auto-decision on submit.
    const request = this.store.createPendingRequest(id, userId);
    return { kind: "pending", request };
  }

  async patchAccessRequest(
    id: string,
    request: AccessRequestPatchRequest,
  ): Promise<AccessRequestDetailsResponse> {
    const existing = this.requireRequest(id);
    if (request.notBefore !== undefined) {
      existing.requestedNotBefore = request.notBefore;
    }
    if (request.notAfter !== undefined) {
      existing.requestedNotAfter = request.notAfter;
    }
    if (request.reason !== undefined) {
      existing.reason = request.reason;
    }
    // Submitting the Request Access modal patches the request — that's the
    // signal the user actually confirmed, so kick off auto-decision now.
    if (existing.status === "pending") {
      this.store.scheduleAutoDecideFor(existing.id);
    }
    // Mirror the confirmed request into the approver inbox so it appears
    // as a pending item. Fire-and-forget; failure is non-critical.
    void this.addRequestToInbox(existing);
    return existing;
  }

  /**
   * Builds an {@link AccessRequestDetailsResponse} from a user-submitted request
   * and inserts it into the inbox store, resolving the real cipher name from
   * the vault. No-ops if the entry already exists.
   */
  private async addRequestToInbox(request: AccessRequestDetailsResponse): Promise<void> {
    if (this.store.inboxRequests.has(request.id)) {
      return;
    }
    try {
      const account = await firstValueFrom(this.accountService.activeAccount$);
      const userId = account?.id;
      if (userId == null) {
        return;
      }
      const [cipher] = await this.cipherService.getAllDecryptedForIds(userId, [request.cipherId]);
      const inbox = PamMockBuilders.buildInboxAccessRequest({
        id: request.id,
        cipherId: request.cipherId,
        collectionId: request.collectionId,
        // Use a distinct mock ID so the self-approval guard (canApprove) does
        // not block the current user from deciding their own demo request.
        requesterId: "mock-requester",
        status: request.status,
        requestedNotBefore: request.requestedNotBefore
          ? new Date(request.requestedNotBefore)
          : null,
        requestedNotAfter: request.requestedNotAfter ? new Date(request.requestedNotAfter) : null,
        requestedTtlSeconds: request.requestedTtlSeconds,
        submittedAt: new Date(request.submittedAt),
        cipherName: cipher?.name ?? `Cipher ${request.cipherId.slice(-4)}`,
        // cipher.collectionIds is a list of GUIDs; resolving the human name
        // would need CollectionService. For mock fidelity, use a friendly
        // default rather than rendering a raw UUID in the history table.
        collectionName: "Your collection",
        requesterName: account?.name ?? null,
        requesterEmail: account?.email ?? "you@example.com",
        reason: request.reason ?? undefined,
      });
      this.store.inboxRequests.set(request.id, inbox);
    } catch {
      // Non-critical — the inbox degrades gracefully if the vault is locked.
    }
  }

  async cancelAccessRequest(id: string): Promise<void> {
    const existing = this.store.requests.get(id);
    if (existing && existing.status === "pending") {
      existing.status = "cancelled";
      existing.resolvedAt = new Date().toISOString();
      // Mirror the cancellation into the inbox so the approver no longer
      // sees a phantom pending row for a request that was withdrawn.
      this.store.syncInboxEntry(existing.id, existing);
      // Re-render the cipher banner (the access-state stream only re-emits on
      // events) so the pending state clears immediately.
      this.store.events$.next({ kind: "cancelled", requestId: existing.id });
    }
  }

  async requestLeaseExtension(
    request: AccessLeaseExtensionRequest,
  ): Promise<AccessRequestDetailsResponse> {
    const parent = this.requireLease(request.leaseId);
    const userId = this.store.currentUserId ?? parent.requesterId;
    // Modelled as a fresh request pointing back at the parent lease; carries the
    // requested window through so approval extends the parent in place (rather
    // than the old behaviour of clobbering leaseId and discarding the window).
    const notBefore = request.notBefore != null ? new Date(request.notBefore) : null;
    const notAfter = request.notAfter != null ? new Date(request.notAfter) : null;
    const startMs = (notBefore ?? new Date()).getTime();
    const ttlSeconds =
      notAfter != null ? Math.max(0, Math.floor((notAfter.getTime() - startMs) / 1000)) : 0;
    const child = this.store.createPendingRequest(parent.cipherId, userId, {
      collectionId: parent.collectionId,
      requestedNotBefore: notBefore,
      requestedNotAfter: notAfter,
      requestedTtlSeconds: ttlSeconds,
      reason: request.reason,
      extensionOfLeaseId: parent.id,
    });
    // Extension modal submits in one step — no separate patch — so kick off
    // auto-decision immediately.
    this.store.scheduleAutoDecideFor(child.id);
    return child;
  }

  async decideAccessRequest(
    id: string,
    request: AccessDecisionRequest,
  ): Promise<AccessRequestDetailsResponse> {
    return this.applyDecision(id, request);
  }

  async activateLease(requestId: string): Promise<AccessLeaseResponse> {
    // Throws (single-active-lease taken / org frozen / window lapsed) bubble up
    // to the caller's toast; the approved request stays activatable for a manual retry.
    return this.store.activateLease(requestId);
  }

  async revokeAccessLease(id: string, request: AccessLeaseRevokeRequest): Promise<void> {
    const lease = this.store.leases.get(id);
    if (!lease) {
      return;
    }
    lease.status = "revoked";
    lease.revokedAt = new Date().toISOString();
    // The mock has no distinct actor identity for a self-/approver-initiated
    // revoke; attribute it to the current user so RevokedLeasesHaveResolverFields
    // holds (revoked_at and revoked_by both set).
    lease.revokedByUserId = this.store.currentUserId ?? lease.requesterId;
    lease.revocationReason = request.reason ?? null;
    if (this.store.leasesByCipher.get(lease.cipherId)?.id === id) {
      this.store.leasesByCipher.delete(lease.cipherId);
    }
    this.store.events$.next({ kind: "revoked", requestId: lease.requestId });
  }

  async listMyAccessRequests(): Promise<AccessRequestDetailsResponse[]> {
    this.store.sweepExpiries();
    const userId = this.store.currentUserId;
    return Array.from(this.store.requests.values())
      .filter((r) => userId == null || r.requesterId === userId)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }

  async listActiveLeases(): Promise<AccessLeaseResponse[]> {
    this.store.sweepExpiries();
    const userId = this.store.currentUserId;
    return Array.from(this.store.leases.values()).filter(
      (l) => l.status === "active" && (userId == null || l.requesterId === userId),
    );
  }

  async getGovernanceSummary(
    organizationId: string,
  ): Promise<OrganizationGovernanceSummaryResponse> {
    const now = Date.now();
    const minutesAgo = (m: number) => new Date(now - m * 60 * 1000).toISOString();
    const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000).toISOString();
    const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000).toISOString();

    // Hardcoded demo rows so the governance dashboard renders meaningful data
    // out of the box. Cipher/collection names mirror the inbox seed in
    // pam-mock-store so the demo reads as one coherent organisation.
    const baseRows = [
      {
        CollectionId: "mock-collection-prod-secrets",
        CollectionName: "Production secrets",
        Conditions: [{ kind: "human_approval" }],
        MemberWithAccessCount: 12,
        PendingRequestCount: 3,
        ActiveLeaseCount: 2,
        LastActivityAt: minutesAgo(8),
      },
      {
        CollectionId: "mock-collection-infrastructure",
        CollectionName: "Infrastructure",
        Conditions: [
          { kind: "human_approval" },
          { kind: "ip_allowlist", cidrs: ["10.0.0.0/8", "192.168.0.0/16"] },
        ],
        MemberWithAccessCount: 7,
        PendingRequestCount: 0,
        ActiveLeaseCount: 1,
        LastActivityAt: hoursAgo(2),
      },
      {
        CollectionId: "mock-collection-monitoring",
        CollectionName: "Monitoring",
        Conditions: [{ kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] }],
        MemberWithAccessCount: 18,
        PendingRequestCount: 1,
        ActiveLeaseCount: 0,
        LastActivityAt: hoursAgo(5),
      },
      {
        CollectionId: "mock-collection-email-services",
        CollectionName: "Email services",
        Conditions: [{ kind: "human_approval" }],
        MemberWithAccessCount: 4,
        PendingRequestCount: 0,
        ActiveLeaseCount: 0,
        LastActivityAt: daysAgo(2),
      },
      {
        CollectionId: "mock-collection-finance",
        CollectionName: "Finance",
        Conditions: [],
        MemberWithAccessCount: 3,
        PendingRequestCount: 0,
        ActiveLeaseCount: 0,
        LastActivityAt: null,
      },
    ];

    // Fold the live store state (member-flow requests/leases for this org) into
    // the hardcoded demo rows so the dashboard reacts to activate / revoke / kill
    // actions instead of showing decorative-only numbers.
    this.store.sweepExpiries();
    const livePending = [...this.store.requests.values()].filter(
      (r) => r.organizationId === organizationId && r.status === "pending",
    ).length;
    const liveActive = [...this.store.leases.values()].filter(
      (l) => l.organizationId === organizationId && l.status === "active",
    ).length;

    return new OrganizationGovernanceSummaryResponse({
      OrganizationId: organizationId,
      LeasingEnabledCollectionCount: baseRows.length,
      TotalPendingRequestCount:
        baseRows.reduce((s, c) => s + c.PendingRequestCount, 0) + livePending,
      TotalActiveLeaseCount: baseRows.reduce((s, c) => s + c.ActiveLeaseCount, 0) + liveActive,
      Collections: baseRows,
    });
  }

  async bulkRevokeLeases(
    organizationId: string,
    blockNewLeases: boolean,
  ): Promise<BulkRevokeResult> {
    const admin = this.store.currentUserId ?? "mock-admin";
    let revoked = 0;
    const now = new Date().toISOString();
    for (const lease of this.store.leases.values()) {
      // Scope to the organization (leases carry their owning org).
      if (lease.status === "active" && lease.organizationId === organizationId) {
        lease.status = "revoked";
        lease.revokedAt = now;
        lease.revokedByUserId = admin;
        lease.revocationReason = "Org-wide kill switch";
        if (this.store.leasesByCipher.get(lease.cipherId)?.id === lease.id) {
          this.store.leasesByCipher.delete(lease.cipherId);
        }
        this.store.events$.next({ kind: "revoked", requestId: lease.requestId });
        revoked += 1;
      }
    }
    // Optionally also block new leases from starting until an admin unblocks.
    if (blockNewLeases) {
      this.store.engageFreeze(organizationId, admin);
    }
    return { kind: "ok", revokedCount: revoked };
  }

  async unblockNewLeases(organizationId: string): Promise<void> {
    this.store.liftFreeze(organizationId);
  }

  async isLeasingFrozen(organizationId: string): Promise<boolean> {
    return this.store.isFrozen(organizationId);
  }

  async listInboxRequests(): Promise<AccessRequestDetailsResponse[]> {
    await this.ensureInboxSeeded();
    this.store.sweepExpiries();
    return Array.from(this.store.inboxRequests.values()).filter((r) => r.status === "pending");
  }

  async listInboxHistory(): Promise<AccessRequestDetailsResponse[]> {
    await this.ensureInboxSeeded();
    this.store.sweepExpiries();
    return Array.from(this.store.inboxRequests.values())
      .filter((r) => r.status !== "pending")
      .sort((a, b) => {
        const aTime = a.resolvedAt ?? a.submittedAt;
        const bTime = b.resolvedAt ?? b.submittedAt;
        return bTime.localeCompare(aTime);
      });
  }

  private applyDecision(
    requestId: string,
    request: AccessDecisionRequest,
  ): AccessRequestDetailsResponse {
    const existing = this.requireRequest(requestId, /* fallbackInbox */ true);
    if (existing.status !== "pending") {
      return existing;
    }
    if (request.verdict === "approve") {
      // Approval issues an approved request — no lease is minted here. The requester
      // activates it via activateLease. An extension instead extends its parent in
      // place. The mock has no approver identity wired in, so approverId
      // stays null (the self-approval guard is enforced by the inbox UI).
      this.store.approveRequest(existing, /* approverId */ null, request.comment ?? undefined);
      return existing;
    }
    const now = new Date();
    existing.status = "denied";
    existing.resolvedAt = now.toISOString();
    existing.approverComment = request.comment ?? null;
    // If the request also lives in inboxRequests (user-submitted), sync
    // resolution fields so the history table shows the correct outcome.
    this.store.syncInboxEntry(requestId, existing);
    this.store.events$.next({ kind: "denied", requestId });
    return existing;
  }

  private requireRequest(id: string, fallbackInbox = false): AccessRequestDetailsResponse {
    const request = this.store.requests.get(id);
    if (request) {
      return request;
    }
    if (fallbackInbox) {
      const inbox = this.store.inboxRequests.get(id);
      if (inbox) {
        return inbox;
      }
    }
    throw new Error(`Mock PAM: lease request ${id} not found`);
  }

  private requireLease(id: string): AccessLeaseResponse {
    const lease = this.store.leases.get(id);
    if (!lease) {
      throw new Error(`Mock PAM: lease ${id} not found`);
    }
    return lease;
  }
}
