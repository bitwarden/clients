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
  // eslint-disable-next-line rxjs/no-exposed-subjects -- intentional mock push channel
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
    const now = new Date();

    // Pending requests that need a decision.
    const pending = [
      { user: "Alex Rivera", email: "alex@example.com", cipher: "Prod database" },
      { user: "Bo Chen", email: "bo@example.com", cipher: "Stripe API key" },
      { user: "Casey Park", email: "casey@example.com", cipher: "AWS root" },
    ];
    for (const f of pending) {
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

    // Historical requests (already resolved).
    // windowOffsetMs: [notBeforeOffsetFromNow, notAfterOffsetFromNow] — defaults to past window.
    const history: Array<{
      user: string;
      email: string;
      cipher: string;
      collection: string;
      status: "approved" | "denied" | "expired";
      resolvedMsAgo: number;
      submittedMsAgo: number;
      comment?: string;
      windowOffsetMs?: [number, number];
    }> = [
      // Active now: window spans the present moment.
      {
        user: "Dana Kim",
        email: "dana@example.com",
        cipher: "GitHub deploy key",
        collection: "Production secrets",
        status: "approved",
        submittedMsAgo: 2 * 60 * 60 * 1000,
        resolvedMsAgo: 1.5 * 60 * 60 * 1000,
        comment: "Approved for hotfix deploy.",
        windowOffsetMs: [-30 * 60 * 1000, 30 * 60 * 1000],
      },
      // Scheduled: window starts in the future.
      {
        user: "Jordan Lee",
        email: "jordan@example.com",
        cipher: "Kubernetes secrets",
        collection: "Infrastructure",
        status: "approved",
        submittedMsAgo: 1 * 60 * 60 * 1000,
        resolvedMsAgo: 45 * 60 * 1000,
        comment: "Pre-approved for tonight's maintenance.",
        windowOffsetMs: [4 * 60 * 60 * 1000, 6 * 60 * 60 * 1000],
      },
      // Today.
      {
        user: "Eli Santos",
        email: "eli@example.com",
        cipher: "Datadog API key",
        collection: "Monitoring",
        status: "denied",
        submittedMsAgo: 5 * 60 * 60 * 1000,
        resolvedMsAgo: 4 * 60 * 60 * 1000,
        comment: "Outside approved hours.",
      },
      // Earlier this week.
      {
        user: "Fran Osei",
        email: "fran@example.com",
        cipher: "Prod database",
        collection: "Production secrets",
        status: "approved",
        submittedMsAgo: 26 * 60 * 60 * 1000,
        resolvedMsAgo: 25 * 60 * 60 * 1000,
      },
      {
        user: "Gus Morita",
        email: "gus@example.com",
        cipher: "SendGrid API key",
        collection: "Email services",
        status: "denied",
        submittedMsAgo: 50 * 60 * 60 * 1000,
        resolvedMsAgo: 49 * 60 * 60 * 1000,
        comment: "No incident ticket provided.",
      },
      // Older.
      {
        user: "Hana Bello",
        email: "hana@example.com",
        cipher: "AWS root",
        collection: "Production secrets",
        status: "expired",
        submittedMsAgo: 10 * 24 * 60 * 60 * 1000,
        resolvedMsAgo: 10 * 24 * 60 * 60 * 1000,
      },
      {
        user: "Ivan Petrov",
        email: "ivan@example.com",
        cipher: "Terraform state",
        collection: "Infrastructure",
        status: "approved",
        submittedMsAgo: 14 * 24 * 60 * 60 * 1000,
        resolvedMsAgo: 14 * 24 * 60 * 60 * 1000,
        comment: "Approved for planned maintenance window.",
      },
    ];
    for (const h of history) {
      const id = this.mintId("inbox-req");
      const cipherId = this.mintId("cipher");
      const submittedAt = new Date(now.getTime() - h.submittedMsAgo);
      const resolvedAt = new Date(now.getTime() - h.resolvedMsAgo);
      const [winStart, winEnd] = h.windowOffsetMs
        ? [
            new Date(now.getTime() + h.windowOffsetMs[0]),
            new Date(now.getTime() + h.windowOffsetMs[1]),
          ]
        : [submittedAt, new Date(submittedAt.getTime() + PamMockConfig.DEFAULT_LEASE_DURATION_MS)];
      const inbox = buildInboxLeaseRequest({
        id,
        cipherId,
        collectionId: this.collectionFor(cipherId),
        requesterUserId: this.mintId("user"),
        status: h.status,
        requestedNotBefore: winStart,
        requestedNotAfter: winEnd,
        requestedTtlSeconds: 3600,
        submittedAt,
        cipherName: h.cipher,
        collectionName: h.collection,
        requesterName: h.user,
        requesterEmail: h.email,
      });
      inbox.resolvedAt = resolvedAt.toISOString();
      if (h.comment) {
        inbox.resolverComment = h.comment;
      }
      // Mint a real lease for approved items that have an active or future
      // window so the revoke button has a leaseId to act on.
      if (h.status === "approved" && h.windowOffsetMs) {
        const lease = buildLease({
          id: this.mintId("lease"),
          requestId: id,
          cipherId,
          collectionId: this.collectionFor(cipherId),
          granteeUserId: this.mintId("user"),
          notBefore: winStart,
          notAfter: winEnd,
          status: "active",
        });
        this.leases.set(lease.id, lease);
        inbox.leaseId = lease.id;
      }
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
