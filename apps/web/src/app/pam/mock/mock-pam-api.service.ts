import { Injectable } from "@angular/core";
import { map, Observable, startWith } from "rxjs";

import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import {
  BulkRevokeResult,
  CipherAccessState,
  CollectionLeasingConfigResponse,
  CollectionLeasingRequest,
  GatedCipherFetchResult,
  InboxBadgeCountResponse,
  InboxLeaseRequestResponse,
  LeaseDecisionRequest,
  LeaseExtensionRequest,
  LeaseRequestPatchRequest,
  LeaseRequestResponse,
  LeaseResponse,
  LeaseRevokeRequest,
  OrganizationGovernanceSummaryResponse,
  PamApiService,
} from "@bitwarden/pam";

import { PamMockConfig } from "./pam-mock-config";
import { PamMockBuilders, PamMockStore } from "./pam-mock-store";

/**
 * DEMO ONLY — implements `PamApiService` against {@link PamMockStore}.
 *
 * Stateful in-memory: a click on a gated cipher creates a pending request,
 * and {@link PamMockStore.createPendingRequest} schedules an auto-decision
 * after {@link PamMockConfig.AUTO_DECIDE_DELAY_MS}. Approve / deny is
 * deterministic per request id.
 */
@Injectable({ providedIn: "root" })
export class MockPamApiService extends PamApiService {
  constructor(private readonly store: PamMockStore) {
    super();
  }

  getCipherAccessState$(cipherId: string, _userId: string): Observable<CipherAccessState> {
    const snapshot = (): CipherAccessState => {
      const activeLease = this.store.leasesByCipher.get(cipherId);
      const pendingRequest = [...this.store.requests.values()].find(
        (r) => r.cipherId === cipherId && r.status === "pending",
      );
      return {
        lease: {
          activeLease: activeLease?.status === "active" ? activeLease : undefined,
          pendingRequest,
        },
        evaluation: PamMockConfig.evaluationForCipher(cipherId),
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
    // Automated policies are evaluated server-side at open time — no Request
    // Access modal, no waiting. The mock approves ~80% and denies ~20% to
    // exercise both branches.
    if (PamMockConfig.evaluationForCipher(id) === "automated") {
      const requestId = this.store.mintId("req");
      if (PamMockConfig.shouldAutoDeny(requestId)) {
        return { kind: "denied", reason: "Outside policy window (mock auto-deny)" };
      }
      const now = new Date();
      const lease = PamMockBuilders.buildLease({
        id: this.store.mintId("lease"),
        requestId,
        cipherId: id,
        collectionId: this.store.collectionFor(id),
        granteeUserId: userId,
        notBefore: now,
        notAfter: new Date(now.getTime() + PamMockConfig.DEFAULT_LEASE_DURATION_MS),
        status: "active",
      });
      this.store.leases.set(lease.id, lease);
      this.store.leasesByCipher.set(id, lease);
      this.store.events$.next({ kind: "approved", requestId });
      return {
        kind: "approved",
        cipher: new CipherResponse({}),
        leaseId: lease.id,
      };
    }
    const request = this.store.createPendingRequest(id, userId);
    return { kind: "pending", request };
  }

  async patchLeaseRequest(
    id: string,
    request: LeaseRequestPatchRequest,
  ): Promise<LeaseRequestResponse> {
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
    return existing;
  }

  async cancelLeaseRequest(id: string): Promise<void> {
    const existing = this.store.requests.get(id);
    if (existing && existing.status === "pending") {
      existing.status = "cancelled";
      existing.resolvedAt = new Date().toISOString();
    }
  }

  async requestLeaseExtension(request: LeaseExtensionRequest): Promise<LeaseRequestResponse> {
    const parent = this.requireLease(request.leaseId);
    const userId = this.store.currentUserId ?? parent.granteeUserId;
    const child = this.store.createPendingRequest(parent.cipherId, userId);
    child.leaseId = parent.id;
    // Extension modal submits in one step — no separate patch — so kick off
    // auto-decision immediately.
    this.store.scheduleAutoDecideFor(child.id);
    return child;
  }

  async decideLeaseRequest(
    id: string,
    request: LeaseDecisionRequest,
  ): Promise<LeaseRequestResponse> {
    return this.applyDecision(id, request);
  }

  async submitDecision(
    requestId: string,
    request: LeaseDecisionRequest,
  ): Promise<LeaseRequestResponse> {
    return this.applyDecision(requestId, request);
  }

  async revokeLease(id: string, request: LeaseRevokeRequest): Promise<void> {
    const lease = this.store.leases.get(id);
    if (!lease) {
      return;
    }
    lease.status = "revoked";
    lease.revokedAt = new Date().toISOString();
    lease.revocationReason = request.reason ?? null;
    if (this.store.leasesByCipher.get(lease.cipherId)?.id === id) {
      this.store.leasesByCipher.delete(lease.cipherId);
    }
  }

  async setCollectionLeasingConfig(
    id: string,
    request: CollectionLeasingRequest,
  ): Promise<CollectionLeasingConfigResponse> {
    const config = new CollectionLeasingConfigResponse({
      CollectionId: id,
      LeasingEnabled: request.leasingEnabled,
      Policy: request.policy as unknown,
    });
    this.store.configs.set(id, config);
    return config;
  }

  async getCollectionLeasingConfig(id: string): Promise<CollectionLeasingConfigResponse> {
    const existing = this.store.configs.get(id);
    if (existing) {
      return existing;
    }
    const fresh = new CollectionLeasingConfigResponse({
      CollectionId: id,
      LeasingEnabled: false,
      Policy: null,
    });
    return fresh;
  }

  async listMyRequests(): Promise<LeaseRequestResponse[]> {
    const userId = this.store.currentUserId;
    return Array.from(this.store.requests.values())
      .filter((r) => userId == null || r.requesterUserId === userId)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }

  async listActiveLeases(): Promise<LeaseResponse[]> {
    const userId = this.store.currentUserId;
    return Array.from(this.store.leases.values()).filter(
      (l) => l.status === "active" && (userId == null || l.granteeUserId === userId),
    );
  }

  async getGovernanceSummary(
    organizationId: string,
  ): Promise<OrganizationGovernanceSummaryResponse> {
    const collectionIds = new Set<string>();
    for (const r of this.store.requests.values()) {
      collectionIds.add(r.collectionId);
    }
    for (const l of this.store.leases.values()) {
      collectionIds.add(l.collectionId);
    }
    const collectionRows = Array.from(collectionIds).map((cid) => {
      const config = this.store.configs.get(cid);
      const pending = Array.from(this.store.requests.values()).filter(
        (r) => r.collectionId === cid && r.status === "pending",
      ).length;
      const active = Array.from(this.store.leases.values()).filter(
        (l) => l.collectionId === cid && l.status === "active",
      ).length;
      return {
        CollectionId: cid,
        CollectionName: `Collection ${cid.slice(-4)}`,
        Policy: config?.policy ?? { kind: "human_approval" },
        RequireLeaseMemberCount: 1,
        PendingRequestCount: pending,
        ActiveLeaseCount: active,
        LastActivityAt: new Date().toISOString(),
      };
    });
    return new OrganizationGovernanceSummaryResponse({
      OrganizationId: organizationId,
      LeasingEnabledCollectionCount: collectionRows.length,
      TotalPendingRequestCount: collectionRows.reduce((s, c) => s + c.PendingRequestCount, 0),
      TotalActiveLeaseCount: collectionRows.reduce((s, c) => s + c.ActiveLeaseCount, 0),
      Collections: collectionRows,
    });
  }

  async bulkRevokeLeases(_organizationId: string): Promise<BulkRevokeResult> {
    let revoked = 0;
    const now = new Date().toISOString();
    for (const lease of this.store.leases.values()) {
      if (lease.status === "active") {
        lease.status = "revoked";
        lease.revokedAt = now;
        lease.revocationReason = "Org-wide kill switch (mock)";
        revoked += 1;
      }
    }
    this.store.leasesByCipher.clear();
    return { kind: "ok", revokedCount: revoked };
  }

  async listInboxRequests(): Promise<InboxLeaseRequestResponse[]> {
    this.store.seedInboxIfNeeded();
    return Array.from(this.store.inboxRequests.values()).filter((r) => r.status === "pending");
  }

  async listInboxHistory(): Promise<InboxLeaseRequestResponse[]> {
    this.store.seedInboxIfNeeded();
    return Array.from(this.store.inboxRequests.values())
      .filter((r) => r.status !== "pending")
      .sort((a, b) => {
        const aTime = a.resolvedAt ?? a.submittedAt;
        const bTime = b.resolvedAt ?? b.submittedAt;
        return bTime.localeCompare(aTime);
      });
  }

  async getInboxBadgeCount(): Promise<InboxBadgeCountResponse> {
    this.store.seedInboxIfNeeded();
    const count = Array.from(this.store.inboxRequests.values()).filter(
      (r) => r.status === "pending",
    ).length;
    return new InboxBadgeCountResponse({ Count: count });
  }

  async getLeaseRequest(id: string): Promise<InboxLeaseRequestResponse> {
    this.store.seedInboxIfNeeded();
    const inbox = this.store.inboxRequests.get(id);
    if (inbox) {
      return inbox;
    }
    // Fall back to projecting an outbound request into the inbox shape so
    // the email-deep-link route always renders something for any known id.
    const request = this.requireRequest(id);
    return PamMockBuilders.buildInboxLeaseRequest({
      id: request.id,
      cipherId: request.cipherId,
      collectionId: request.collectionId,
      requesterUserId: request.requesterUserId,
      status: request.status,
      requestedNotBefore: request.requestedNotBefore ? new Date(request.requestedNotBefore) : null,
      requestedNotAfter: request.requestedNotAfter ? new Date(request.requestedNotAfter) : null,
      requestedTtlSeconds: request.requestedTtlSeconds,
      submittedAt: new Date(request.submittedAt),
      cipherName: `Cipher ${request.cipherId.slice(-4)}`,
      collectionName: `Collection ${request.collectionId.slice(-4)}`,
      requesterName: "You",
      requesterEmail: "you@example.com",
    });
  }

  private applyDecision(requestId: string, request: LeaseDecisionRequest): LeaseRequestResponse {
    const existing = this.requireRequest(requestId, /* fallbackInbox */ true);
    if (existing.status !== "pending") {
      return existing;
    }
    const now = new Date();
    existing.status = request.decision === "approve" ? "approved" : "denied";
    existing.resolvedAt = now.toISOString();
    existing.resolverComment = request.comment ?? null;
    if (request.decision === "approve") {
      const lease = PamMockBuilders.buildLease({
        id: this.store.mintId("lease"),
        requestId: existing.id,
        cipherId: existing.cipherId,
        collectionId: existing.collectionId,
        granteeUserId: existing.requesterUserId,
        notBefore: now,
        notAfter: new Date(now.getTime() + PamMockConfig.DEFAULT_LEASE_DURATION_MS),
        status: "active",
      });
      this.store.leases.set(lease.id, lease);
      this.store.leasesByCipher.set(existing.cipherId, lease);
      existing.leaseId = lease.id;
    }
    this.store.events$.next({
      kind: request.decision === "approve" ? "approved" : "denied",
      requestId,
    });
    return existing;
  }

  private requireRequest(id: string, fallbackInbox = false): LeaseRequestResponse {
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

  private requireLease(id: string): LeaseResponse {
    const lease = this.store.leases.get(id);
    if (!lease) {
      throw new Error(`Mock PAM: lease ${id} not found`);
    }
    return lease;
  }
}
