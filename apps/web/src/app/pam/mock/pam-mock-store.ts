import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

import {
  CollectionLeasingConfigResponse,
  InboxLeaseRequestResponse,
  LeaseEvent,
  LeaseRequestResponse,
  LeaseResponse,
} from "@bitwarden/pam";

import { PamMockConfig } from "./pam-mock-config";

/**
 * DEMO ONLY — in-memory state for the PAM mock. Singleton across the app so
 * multiple components see consistent state (the modal, the pending-state
 * block, the active-leases view, etc.). Resets implicitly on page reload.
 */
@Injectable({ providedIn: "root" })
export class PamMockStore {
  /** Request id → request. */
  readonly requests = new Map<string, LeaseRequestResponse>();

  /** Lease id → lease. */
  readonly leases = new Map<string, LeaseResponse>();

  /** Cipher id → the latest *active* lease (if any) for the current user. */
  readonly leasesByCipher = new Map<string, LeaseResponse>();

  /** Collection id → leasing config. */
  readonly configs = new Map<string, CollectionLeasingConfigResponse>();

  /** Inbox requests synthesised "from other users" so the approver UI has rows. */
  readonly inboxRequests = new Map<string, InboxLeaseRequestResponse>();

  /** Set when the first interceptor open fires; used to assign leases. */
  currentUserId: string | null = null;

  /** Push channel — `events$.next({ kind, requestId })` to deliver an event. */
  readonly events$ = new Subject<LeaseEvent>();

  private seededInbox = false;
  private nextId = 1;

  /** Returns a stable mock collection id for a given cipher id. */
  collectionFor(cipherId: string): string {
    return `mock-collection-${cipherId.slice(0, 8)}`;
  }

  /**
   * If the cipher should start with an active lease (per the deterministic
   * predicate), make sure one exists in the store. Idempotent.
   */
  ensureSeedLease(cipherId: string, userId: string): void {
    this.currentUserId ??= userId;
    if (!PamMockConfig.shouldStartWithActiveLease(cipherId)) {
      return;
    }
    if (this.leasesByCipher.has(cipherId)) {
      return;
    }
    const now = new Date();
    const notAfter = new Date(now.getTime() + PamMockConfig.DEFAULT_LEASE_DURATION_MS);
    const lease = buildLease({
      id: this.mintId("lease"),
      requestId: this.mintId("req"),
      cipherId,
      collectionId: this.collectionFor(cipherId),
      granteeUserId: userId,
      notBefore: now,
      notAfter,
      status: "active",
    });
    this.leases.set(lease.id, lease);
    this.leasesByCipher.set(cipherId, lease);
  }

  /**
   * Create a new pending request for a gated cipher and schedule its
   * auto-decision. Returns the freshly-created request.
   */
  createPendingRequest(cipherId: string, userId: string): LeaseRequestResponse {
    this.currentUserId ??= userId;
    const id = this.mintId("req");
    const now = new Date();
    const notAfter = new Date(now.getTime() + PamMockConfig.DEFAULT_LEASE_DURATION_MS);
    const request = buildLeaseRequest({
      id,
      cipherId,
      collectionId: this.collectionFor(cipherId),
      requesterUserId: userId,
      status: "pending",
      requestedNotBefore: now,
      requestedNotAfter: notAfter,
      requestedTtlSeconds: Math.floor(PamMockConfig.DEFAULT_LEASE_DURATION_MS / 1000),
      submittedAt: now,
    });
    this.requests.set(id, request);
    this.scheduleAutoDecide(id);
    return request;
  }

  /**
   * After the auto-decide delay, flip the request to approved or denied
   * (deterministic per request id) and emit the corresponding event.
   */
  private scheduleAutoDecide(requestId: string): void {
    setTimeout(() => {
      const request = this.requests.get(requestId);
      if (!request || request.status !== "pending") {
        // Cancelled or already decided — nothing to do.
        return;
      }
      const now = new Date();
      if (PamMockConfig.shouldAutoDeny(requestId)) {
        request.status = "denied";
        request.resolvedAt = now.toISOString();
        request.resolverComment = "Outside policy window (mock auto-deny)";
        this.events$.next({ kind: "denied", requestId });
        return;
      }
      // Approve: mint a lease, link it on the request, broadcast.
      const lease = buildLease({
        id: this.mintId("lease"),
        requestId,
        cipherId: request.cipherId,
        collectionId: request.collectionId,
        granteeUserId: request.requesterUserId,
        notBefore: now,
        notAfter: new Date(now.getTime() + PamMockConfig.DEFAULT_LEASE_DURATION_MS),
        status: "active",
      });
      this.leases.set(lease.id, lease);
      this.leasesByCipher.set(request.cipherId, lease);
      request.status = "approved";
      request.resolvedAt = now.toISOString();
      request.leaseId = lease.id;
      this.events$.next({ kind: "approved", requestId });
    }, PamMockConfig.AUTO_DECIDE_DELAY_MS);
  }

  /** Seed a small set of inbox requests "from other users" on first read. */
  seedInboxIfNeeded(): void {
    if (this.seededInbox) {
      return;
    }
    this.seededInbox = true;
    const fakes = [
      { user: "Alex Rivera", email: "alex@example.com", cipher: "Prod database" },
      { user: "Bo Chen", email: "bo@example.com", cipher: "Stripe API key" },
      { user: "Casey Park", email: "casey@example.com", cipher: "AWS root" },
    ];
    const now = new Date();
    for (const f of fakes) {
      const id = this.mintId("inbox-req");
      const cipherId = this.mintId("cipher");
      const inbox = buildInboxLeaseRequest({
        id,
        cipherId,
        collectionId: this.collectionFor(cipherId),
        requesterUserId: this.mintId("user"),
        status: "pending",
        requestedNotBefore: now,
        requestedNotAfter: new Date(now.getTime() + PamMockConfig.DEFAULT_LEASE_DURATION_MS),
        requestedTtlSeconds: 3600,
        submittedAt: now,
        cipherName: f.cipher,
        collectionName: "Production secrets",
        requesterName: f.user,
        requesterEmail: f.email,
      });
      this.inboxRequests.set(id, inbox);
    }
  }

  mintId(prefix: string): string {
    return `${prefix}-${this.nextId++}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

// --- builders ----------------------------------------------------------------
// Mint response-class instances by passing a PascalCased POJO through their
// constructors. BaseResponse.getResponseProperty handles the casing.

function buildLease(init: {
  id: string;
  requestId: string;
  cipherId: string;
  collectionId: string;
  granteeUserId: string;
  notBefore: Date;
  notAfter: Date;
  status: "active" | "expired" | "revoked";
}): LeaseResponse {
  return new LeaseResponse({
    Id: init.id,
    RequestId: init.requestId,
    CipherId: init.cipherId,
    CollectionId: init.collectionId,
    GranteeUserId: init.granteeUserId,
    NotBefore: init.notBefore.toISOString(),
    NotAfter: init.notAfter.toISOString(),
    Status: init.status,
    RevokedAt: null,
    RevokedByUserId: null,
    RevocationReason: null,
  });
}

function buildLeaseRequest(init: {
  id: string;
  cipherId: string;
  collectionId: string;
  requesterUserId: string;
  status: "pending" | "approved" | "denied" | "cancelled" | "expired";
  requestedNotBefore: Date | null;
  requestedNotAfter: Date | null;
  requestedTtlSeconds: number;
  submittedAt: Date;
  reason?: string;
}): LeaseRequestResponse {
  return new LeaseRequestResponse({
    Id: init.id,
    CipherId: init.cipherId,
    CollectionId: init.collectionId,
    RequesterUserId: init.requesterUserId,
    Status: init.status,
    RequestedNotBefore: init.requestedNotBefore?.toISOString() ?? null,
    RequestedNotAfter: init.requestedNotAfter?.toISOString() ?? null,
    RequestedTtlSeconds: init.requestedTtlSeconds,
    Reason: init.reason ?? null,
    SubmittedAt: init.submittedAt.toISOString(),
    ResolvedAt: null,
    ResolverUserId: null,
    ResolverComment: null,
    LeaseId: null,
  });
}

function buildInboxLeaseRequest(init: {
  id: string;
  cipherId: string;
  collectionId: string;
  requesterUserId: string;
  status: "pending" | "approved" | "denied" | "cancelled" | "expired";
  requestedNotBefore: Date | null;
  requestedNotAfter: Date | null;
  requestedTtlSeconds: number;
  submittedAt: Date;
  cipherName: string;
  collectionName: string;
  requesterName: string | null;
  requesterEmail: string;
}): InboxLeaseRequestResponse {
  return new InboxLeaseRequestResponse({
    Id: init.id,
    CipherId: init.cipherId,
    CollectionId: init.collectionId,
    RequesterUserId: init.requesterUserId,
    Status: init.status,
    RequestedNotBefore: init.requestedNotBefore?.toISOString() ?? null,
    RequestedNotAfter: init.requestedNotAfter?.toISOString() ?? null,
    RequestedTtlSeconds: init.requestedTtlSeconds,
    Reason: null,
    SubmittedAt: init.submittedAt.toISOString(),
    ResolvedAt: null,
    ResolverUserId: null,
    ResolverComment: null,
    LeaseId: null,
    CipherName: init.cipherName,
    CollectionName: init.collectionName,
    RequesterName: init.requesterName,
    RequesterEmail: init.requesterEmail,
  });
}

export const PamMockBuilders = { buildLease, buildLeaseRequest, buildInboxLeaseRequest };
