import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

import {
  AccessRuleResponse,
  AccessRequestStatus,
  InboxAccessRequestResponse,
  LeaseEvent,
  AccessRequestResponse,
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
  readonly requests = new Map<string, AccessRequestResponse>();

  /** Lease id → lease. */
  readonly leases = new Map<string, LeaseResponse>();

  /** Cipher id → the latest *active* lease (if any) for the current user. */
  readonly leasesByCipher = new Map<string, LeaseResponse>();

  /** Inbox requests synthesised "from other users" so the approver UI has rows. */
  readonly inboxRequests = new Map<string, InboxAccessRequestResponse>();

  /** Access rule id → rule. Survives the session; resets on reload. */
  readonly accessRules = new Map<string, AccessRuleResponse>();

  /**
   * Organization id → engaged leasing freeze. Its presence IS the "blocked"
   * state; while one exists no ticket can be redeemed for that org. Keyed by
   * org id, so there is at most one per organization (AtMostOneLeasingFreezePerOrg).
   */
  readonly leasingFreezes = new Map<string, { engagedAt: string; engagedByUserId: string }>();

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
   * For demo realism, lazily seed a pre-existing active lease for a fraction
   * of gated ciphers on first open. Idempotent. The decision is deterministic
   * per cipher id so a returning user lands on the same state. Real gating
   * (which ciphers are gated at all) is driven by the server's `partialData`
   * sync field; this method only runs for ciphers already known to be gated
   * (i.e. `fetchGatedCipher` has been called for them).
   */
  ensureSeedLease(cipherId: string, userId: string): void {
    this.currentUserId ??= userId;
    if (!shouldSeedActiveLease(cipherId)) {
      return;
    }
    if (this.leasesByCipher.has(cipherId)) {
      return;
    }
    const now = new Date();
    const notAfter = new Date(now.getTime() + PamMockConfig.DEFAULT_LEASE_DURATION_MS);
    // A lease only exists because a ticket was redeemed; give the seed lease a
    // real backing `activated` request so NoLeaseWithoutActivatedRequest and
    // AtMostOneLeasePerActivatedRequest hold for seeded state too.
    const requestId = this.mintId("req");
    const leaseId = this.mintId("lease");
    const request = buildAccessRequest({
      id: requestId,
      cipherId,
      collectionId: this.collectionFor(cipherId),
      organizationId: PamMockConfig.MOCK_ORG_ID,
      requesterUserId: userId,
      status: "activated",
      requestedNotBefore: now,
      requestedNotAfter: notAfter,
      requestedTtlSeconds: Math.floor(PamMockConfig.DEFAULT_LEASE_DURATION_MS / 1000),
      submittedAt: now,
      resolvedAt: now,
      leaseId,
    });
    this.requests.set(requestId, request);
    const lease = buildLease({
      id: leaseId,
      requestId,
      cipherId,
      collectionId: this.collectionFor(cipherId),
      organizationId: PamMockConfig.MOCK_ORG_ID,
      granteeUserId: userId,
      notBefore: now,
      notAfter,
      status: "active",
    });
    this.leases.set(lease.id, lease);
    this.leasesByCipher.set(cipherId, lease);
  }

  /**
   * Ensures a pre-existing pending request exists for a cipher (simulating a
   * request submitted ~30 minutes ago in a prior session). Idempotent.
   */
  ensureSeedPendingRequest(cipherId: string, userId: string): void {
    this.currentUserId ??= userId;
    if (
      [...this.requests.values()].some((r) => r.cipherId === cipherId && r.status === "pending")
    ) {
      return;
    }
    const id = this.mintId("req");
    const now = new Date();
    const submittedAt = new Date(now.getTime() - 30 * 60 * 1000);
    const notAfter = new Date(now.getTime() + PamMockConfig.DEFAULT_LEASE_DURATION_MS);
    const request = buildAccessRequest({
      id,
      cipherId,
      collectionId: this.collectionFor(cipherId),
      requesterUserId: userId,
      status: "pending",
      requestedNotBefore: now,
      requestedNotAfter: notAfter,
      requestedTtlSeconds: Math.floor(PamMockConfig.DEFAULT_LEASE_DURATION_MS / 1000),
      submittedAt,
    });
    this.requests.set(id, request);
  }

  /**
   * Create a new pending request for a gated cipher. Auto-decision is NOT
   * scheduled here — call {@link scheduleAutoDecideFor} once the user has
   * actually confirmed the request via the Request Access modal.
   *
   * Gated opens default to an *on-demand* ticket (no scheduled start); a
   * scheduled window is set later via patch if the requester picks one. An
   * extension passes the parent lease id so approval extends it in place.
   */
  createPendingRequest(
    cipherId: string,
    userId: string,
    opts: {
      collectionId?: string;
      requestedNotBefore?: Date | null;
      requestedNotAfter?: Date | null;
      requestedTtlSeconds?: number;
      reason?: string;
      extensionOfLeaseId?: string | null;
    } = {},
  ): AccessRequestResponse {
    this.currentUserId ??= userId;
    const id = this.mintId("req");
    const now = new Date();
    const request = buildAccessRequest({
      id,
      cipherId,
      collectionId: opts.collectionId ?? this.collectionFor(cipherId),
      organizationId: PamMockConfig.MOCK_ORG_ID,
      requesterUserId: userId,
      status: "pending",
      requestedNotBefore: opts.requestedNotBefore ?? null,
      requestedNotAfter: opts.requestedNotAfter ?? null,
      requestedTtlSeconds:
        opts.requestedTtlSeconds ?? Math.floor(PamMockConfig.DEFAULT_LEASE_DURATION_MS / 1000),
      submittedAt: now,
      reason: opts.reason,
      extensionOfLeaseId: opts.extensionOfLeaseId ?? null,
    });
    this.requests.set(id, request);
    return request;
  }

  /** Public entry point so the API layer can trigger auto-decide on submit. */
  scheduleAutoDecideFor(requestId: string): void {
    this.scheduleAutoDecide(requestId);
  }

  /**
   * After the auto-decide delay, resolve the request (deterministic per request
   * id) and emit the corresponding event. Approval issues a *ticket* — no lease
   * is minted here; the requester redeems it via {@link startLease}.
   */
  private scheduleAutoDecide(requestId: string): void {
    setTimeout(() => {
      const request = this.requests.get(requestId);
      if (!request || request.status !== "pending") {
        // Cancelled or already decided — nothing to do.
        return;
      }
      if (PamMockConfig.shouldAutoDeny(requestId)) {
        request.status = "denied";
        request.resolvedAt = new Date().toISOString();
        request.resolverComment = "Outside access-rule window";
        this.syncInboxEntry(requestId, request);
        this.events$.next({ kind: "denied", requestId });
        return;
      }
      // Auto-approve (no human-approval condition): resolver is null.
      this.approveRequest(request, null);
    }, PamMockConfig.AUTO_DECIDE_DELAY_MS);
  }

  /**
   * Apply an approval to a pending request. An extension extends its parent
   * lease in place (ExtensionApprovedExtendsParentLease) and never mints a
   * redeemable ticket; everything else becomes an approved *ticket* the
   * requester redeems via {@link startLease}. `resolverUserId` is null for an
   * auto / access-rule decision, or the approver for a human decision.
   */
  approveRequest(
    request: AccessRequestResponse,
    resolverUserId: string | null,
    comment?: string,
  ): void {
    const now = new Date();
    request.resolvedAt = now.toISOString();
    request.resolverUserId = resolverUserId;
    if (comment !== undefined) {
      request.resolverComment = comment;
    }

    if (request.extensionOfLeaseId != null) {
      const parent = this.leases.get(request.extensionOfLeaseId);
      if (parent == null || parent.status !== "active") {
        // ExtensionDeniedParentGone — nothing left to extend.
        request.status = "denied";
        request.resolverComment = "The lease being extended has ended";
        this.syncInboxEntry(request.id, request);
        this.events$.next({ kind: "denied", requestId: request.id });
        return;
      }
      // ExtensionApprovedExtendsParentLease — push the parent's end out in place.
      if (request.requestedNotAfter != null) {
        parent.notAfter = request.requestedNotAfter;
      }
      request.status = "activated";
      request.leaseId = parent.id;
      this.syncInboxEntry(request.id, request);
      this.events$.next({ kind: "activated", requestId: request.id });
      return;
    }

    request.status = "approved";
    // An on-demand ticket is bounded by the redemption deadline; a scheduled
    // ticket is instead bounded by its requested window.
    if (isOnDemand(request, now.getTime())) {
      request.redemptionDeadline = new Date(
        now.getTime() + PamMockConfig.TICKET_REDEMPTION_DEADLINE_MS,
      ).toISOString();
    }
    this.syncInboxEntry(request.id, request);
    this.events$.next({ kind: "approved", requestId: request.id });
  }

  /**
   * Redeem an approved ticket (MemberStartsLease): mint the lease and move the
   * request to `activated`. Throws when the org is under a leasing freeze, the
   * rule's single-active-lease slot is taken, or the scheduled window /
   * redemption deadline has lapsed — the ticket stays `approved` for a manual
   * retry. Extensions never reach here (they apply in place on approval).
   */
  startLease(requestId: string): LeaseResponse {
    const request = this.requests.get(requestId);
    if (request == null) {
      throw new Error(`Mock PAM: request ${requestId} not found`);
    }
    if (request.status !== "approved" || request.extensionOfLeaseId != null) {
      throw new Error("Mock PAM: request is not a redeemable ticket");
    }
    const now = new Date();
    const nowMs = now.getTime();

    if (request.organizationId != null && this.leasingFreezes.has(request.organizationId)) {
      throw new Error("Mock PAM: new leases are blocked by an org-wide leasing freeze");
    }

    const rule = request.ruleId != null ? this.accessRules.get(request.ruleId) : undefined;
    // RuleAllowsLease — single_active_lease contention, checked here at start.
    if (rule?.singleActiveLease) {
      const taken = [...this.leases.values()].some(
        (l) => l.ruleId === rule.id && l.status === "active",
      );
      if (taken) {
        throw new Error("Mock PAM: the single active lease for this rule is already taken");
      }
    }
    const maxMs =
      rule?.maxLeaseDurationSeconds != null ? rule.maxLeaseDurationSeconds * 1000 : null;

    let notBefore: Date;
    let notAfter: Date;
    // Classify on-demand vs scheduled off the *approval* instant (the same
    // reference approveRequest/sweepExpiries use), never the live `nowMs`:
    // re-deriving it from `nowMs` would flip a scheduled ticket to on-demand the
    // moment its window opened, making the scheduled branch below unreachable and
    // silently discarding the chosen window.
    const classificationRef = Date.parse(request.resolvedAt ?? request.submittedAt);
    if (!isOnDemand(request, classificationRef)) {
      // Scheduled: redeemable only inside [not_before, not_after].
      const nb = Date.parse(request.requestedNotBefore as string);
      const na = request.requestedNotAfter != null ? Date.parse(request.requestedNotAfter) : nb;
      if (nowMs < nb) {
        throw new Error("Mock PAM: the scheduled window has not opened yet");
      }
      if (nowMs > na) {
        throw new Error("Mock PAM: the scheduled window has passed");
      }
      notBefore = new Date(nb);
      // Clamp the window to the rule's max_lease_duration ceiling, if any.
      notAfter = new Date(maxMs != null && na - nb > maxMs ? nb + maxMs : na);
    } else {
      // On-demand: redeemable up to the redemption deadline; runs from now.
      if (request.redemptionDeadline != null && nowMs > Date.parse(request.redemptionDeadline)) {
        throw new Error("Mock PAM: the ticket's redemption window has passed");
      }
      const ttlMs = request.requestedTtlSeconds * 1000;
      const grantedMs = maxMs != null && ttlMs > maxMs ? maxMs : ttlMs;
      notBefore = now;
      notAfter = new Date(nowMs + grantedMs);
    }

    const lease = buildLease({
      id: this.mintId("lease"),
      requestId: request.id,
      cipherId: request.cipherId,
      collectionId: request.collectionId,
      ruleId: request.ruleId,
      organizationId: request.organizationId,
      granteeUserId: request.requesterUserId,
      notBefore,
      notAfter,
      status: "active",
    });
    this.leases.set(lease.id, lease);
    this.leasesByCipher.set(lease.cipherId, lease);
    request.status = "activated";
    request.leaseId = lease.id;
    this.syncInboxEntry(request.id, request);
    this.events$.next({ kind: "activated", requestId: request.id });
    return lease;
  }

  /**
   * Lazy expiry sweep, run on reads. Flips lapsed leases and requests to their
   * terminal states: LeaseExpires, PendingRequestExpires,
   * ApprovedOnDemandTicketExpiresUnredeemed and ScheduledTicketExpiresAfterWindow.
   * Pass `emit: false` to mutate without broadcasting (e.g. inside a snapshot).
   */
  sweepExpiries({ emit }: { emit: boolean } = { emit: true }): void {
    const nowMs = Date.now();
    const fire = (requestId: string, kind: LeaseEvent["kind"]) => {
      if (emit) {
        this.events$.next({ kind, requestId });
      }
    };

    for (const lease of this.leases.values()) {
      if (lease.status === "active" && nowMs >= Date.parse(lease.notAfter)) {
        lease.status = "expired";
        if (this.leasesByCipher.get(lease.cipherId)?.id === lease.id) {
          this.leasesByCipher.delete(lease.cipherId);
        }
        fire(lease.requestId, "expired");
      }
    }

    for (const request of this.requests.values()) {
      if (request.status === "pending") {
        const deadline =
          Date.parse(request.submittedAt) + PamMockConfig.REQUEST_DECISION_DEADLINE_MS;
        if (nowMs >= deadline) {
          const stamp = new Date(nowMs).toISOString();
          request.status = "expired";
          request.resolvedAt = stamp;
          request.expiredAt = stamp;
          this.syncInboxEntry(request.id, request);
          fire(request.id, "expired");
        }
        continue;
      }
      if (request.status === "approved" && request.extensionOfLeaseId == null) {
        const refMs = Date.parse(request.resolvedAt ?? request.submittedAt);
        const lapsed = isOnDemand(request, refMs)
          ? request.redemptionDeadline != null && nowMs > Date.parse(request.redemptionDeadline)
          : request.requestedNotAfter != null && nowMs >= Date.parse(request.requestedNotAfter);
        if (lapsed) {
          request.status = "expired";
          request.expiredAt = new Date(nowMs).toISOString();
          this.syncInboxEntry(request.id, request);
          fire(request.id, "expired");
        }
      }
    }
  }

  /** Engages an org-wide leasing freeze. Idempotent (at most one per org). */
  engageFreeze(organizationId: string, engagedByUserId: string): void {
    if (this.leasingFreezes.has(organizationId)) {
      return;
    }
    this.leasingFreezes.set(organizationId, {
      engagedAt: new Date().toISOString(),
      engagedByUserId,
    });
  }

  /** Lifts an org-wide leasing freeze, if one exists. */
  liftFreeze(organizationId: string): void {
    this.leasingFreezes.delete(organizationId);
  }

  /** Whether the organization currently has a leasing freeze engaged. */
  isFrozen(organizationId: string): boolean {
    return this.leasingFreezes.has(organizationId);
  }

  /**
   * Seed a small set of inbox requests "from other users" on first read.
   *
   * @param realCipherIds Real vault cipher IDs to use for the mock entries so
   *   that "View in vault" links resolve. Cycled round-robin if fewer IDs than
   *   entries. Pass an empty array to fall back to generated IDs.
   */
  seedInboxIfNeeded(realCipherIds: string[] = []): void {
    if (this.seededInbox) {
      return;
    }
    this.seededInbox = true;
    let cipherIndex = 0;
    const nextCipherId = (): string =>
      realCipherIds.length > 0
        ? realCipherIds[cipherIndex++ % realCipherIds.length]
        : this.mintId("cipher");
    const now = new Date();

    // Pending requests that need a decision.
    const pending = [
      {
        user: "Alex Rivera",
        email: "alex@example.com",
        cipher: "Prod database",
        reason: "Investigating slow query on orders table — need read access to run EXPLAIN.",
      },
      {
        user: "Bo Chen",
        email: "bo@example.com",
        cipher: "Stripe API key",
        reason: "Refund processing for incident INC-4821.",
      },
      { user: "Casey Park", email: "casey@example.com", cipher: "AWS root" },
    ];
    for (const f of pending) {
      const id = this.mintId("inbox-req");
      const cipherId = nextCipherId();
      const inbox = buildInboxAccessRequest({
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
        reason: f.reason,
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
      status: AccessRequestStatus;
      resolvedMsAgo: number;
      submittedMsAgo: number;
      reason?: string;
      comment?: string;
      windowOffsetMs?: [number, number];
    }> = [
      // Active now: a redeemed ticket whose lease window spans the present moment.
      {
        user: "Dana Kim",
        email: "dana@example.com",
        cipher: "GitHub deploy key",
        collection: "Production secrets",
        status: "activated",
        submittedMsAgo: 2 * 60 * 60 * 1000,
        resolvedMsAgo: 1.5 * 60 * 60 * 1000,
        reason: "Emergency hotfix for login regression — need to push to production.",
        comment: "Approved for hotfix deploy.",
        windowOffsetMs: [-30 * 60 * 1000, 30 * 60 * 1000],
      },
      // Scheduled: a redeemed ticket whose lease window starts in the future.
      {
        user: "Jordan Lee",
        email: "jordan@example.com",
        cipher: "Kubernetes secrets",
        collection: "Infrastructure",
        status: "activated",
        submittedMsAgo: 1 * 60 * 60 * 1000,
        resolvedMsAgo: 45 * 60 * 1000,
        reason: "Scheduled maintenance window tonight, need cluster access to rotate certs.",
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
        reason: "Need to set up a new alert for payment failures.",
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
        reason: "Quarterly data export for finance team.",
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
        reason: "Need to update billing IAM policy.",
      },
      {
        user: "Ivan Petrov",
        email: "ivan@example.com",
        cipher: "Terraform state",
        collection: "Infrastructure",
        status: "approved",
        submittedMsAgo: 14 * 24 * 60 * 60 * 1000,
        resolvedMsAgo: 14 * 24 * 60 * 60 * 1000,
        reason: "Applying infrastructure changes from approved RFC-112.",
        comment: "Approved for planned maintenance window.",
      },
    ];
    for (const h of history) {
      const id = this.mintId("inbox-req");
      const cipherId = nextCipherId();
      const submittedAt = new Date(now.getTime() - h.submittedMsAgo);
      const resolvedAt = new Date(now.getTime() - h.resolvedMsAgo);
      const [winStart, winEnd] = h.windowOffsetMs
        ? [
            new Date(now.getTime() + h.windowOffsetMs[0]),
            new Date(now.getTime() + h.windowOffsetMs[1]),
          ]
        : [submittedAt, new Date(submittedAt.getTime() + PamMockConfig.DEFAULT_LEASE_DURATION_MS)];
      const inbox = buildInboxAccessRequest({
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
        reason: h.reason,
      });
      inbox.resolvedAt = resolvedAt.toISOString();
      if (h.comment) {
        inbox.resolverComment = h.comment;
      }
      // Mint a real lease for activated (redeemed) items that have an active or
      // future window so the revoke button has a leaseId to act on.
      if (h.status === "activated" && h.windowOffsetMs) {
        const lease = buildLease({
          id: this.mintId("lease"),
          requestId: id,
          cipherId,
          collectionId: this.collectionFor(cipherId),
          organizationId: PamMockConfig.MOCK_ORG_ID,
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

  /**
   * Copies resolution fields from a decided {@link AccessRequestResponse} into
   * the matching inbox entry (if one exists). Called after auto-decide so the
   * history table reflects the outcome for user-submitted requests.
   */
  syncInboxEntry(requestId: string, source: AccessRequestResponse): void {
    const entry = this.inboxRequests.get(requestId);
    if (!entry) {
      return;
    }
    entry.status = source.status;
    entry.resolvedAt = source.resolvedAt;
    entry.resolverComment = source.resolverComment;
    entry.leaseId = source.leaseId;
  }

  mintId(prefix: string): string {
    return `${prefix}-${this.nextId++}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

/**
 * Whether a ticket is on-demand (redeemable now, bounded by the redemption
 * deadline) versus scheduled (bounded by a future window). The spec keys this
 * on `requested_not_before != null`; the mock additionally treats a "start now"
 * window (not_before at or before the reference instant) as on-demand, since
 * the request modal stamps not_before = now for preset durations.
 */
function isOnDemand(request: AccessRequestResponse, refMs: number): boolean {
  if (request.requestedNotBefore == null) {
    return true;
  }
  return Date.parse(request.requestedNotBefore) <= refMs + 60_000;
}

// --- builders ----------------------------------------------------------------
// Mint response-class instances by passing a PascalCased POJO through their
// constructors. BaseResponse.getResponseProperty handles the casing.

function buildLease(init: {
  id: string;
  requestId: string;
  cipherId: string;
  collectionId: string;
  ruleId?: string | null;
  organizationId?: string | null;
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
    RuleId: init.ruleId ?? null,
    OrganizationId: init.organizationId ?? null,
    GranteeUserId: init.granteeUserId,
    NotBefore: init.notBefore.toISOString(),
    NotAfter: init.notAfter.toISOString(),
    Status: init.status,
    RevokedAt: null,
    RevokedByUserId: null,
    RevocationReason: null,
  });
}

function buildAccessRequest(init: {
  id: string;
  cipherId: string;
  collectionId: string;
  ruleId?: string | null;
  organizationId?: string | null;
  requesterUserId: string;
  status: AccessRequestStatus;
  requestedNotBefore: Date | null;
  requestedNotAfter: Date | null;
  requestedTtlSeconds: number;
  submittedAt: Date;
  resolvedAt?: Date | null;
  reason?: string;
  leaseId?: string | null;
  extensionOfLeaseId?: string | null;
}): AccessRequestResponse {
  return new AccessRequestResponse({
    Id: init.id,
    CipherId: init.cipherId,
    CollectionId: init.collectionId,
    RuleId: init.ruleId ?? null,
    OrganizationId: init.organizationId ?? null,
    RequesterUserId: init.requesterUserId,
    Status: init.status,
    RequestedNotBefore: init.requestedNotBefore?.toISOString() ?? null,
    RequestedNotAfter: init.requestedNotAfter?.toISOString() ?? null,
    RequestedTtlSeconds: init.requestedTtlSeconds,
    Reason: init.reason ?? null,
    SubmittedAt: init.submittedAt.toISOString(),
    ResolvedAt: init.resolvedAt?.toISOString() ?? null,
    ExpiredAt: null,
    ResolverUserId: null,
    ResolverComment: null,
    LeaseId: init.leaseId ?? null,
    ExtensionOfLeaseId: init.extensionOfLeaseId ?? null,
    RedemptionDeadline: null,
  });
}

function buildInboxAccessRequest(init: {
  id: string;
  cipherId: string;
  collectionId: string;
  requesterUserId: string;
  status: AccessRequestStatus;
  requestedNotBefore: Date | null;
  requestedNotAfter: Date | null;
  requestedTtlSeconds: number;
  submittedAt: Date;
  cipherName: string;
  collectionName: string;
  requesterName: string | null;
  requesterEmail: string;
  reason?: string;
}): InboxAccessRequestResponse {
  return new InboxAccessRequestResponse({
    Id: init.id,
    CipherId: init.cipherId,
    CollectionId: init.collectionId,
    RuleId: null,
    OrganizationId: PamMockConfig.MOCK_ORG_ID,
    RequesterUserId: init.requesterUserId,
    Status: init.status,
    RequestedNotBefore: init.requestedNotBefore?.toISOString() ?? null,
    RequestedNotAfter: init.requestedNotAfter?.toISOString() ?? null,
    RequestedTtlSeconds: init.requestedTtlSeconds,
    Reason: init.reason ?? null,
    SubmittedAt: init.submittedAt.toISOString(),
    ResolvedAt: null,
    ExpiredAt: null,
    ResolverUserId: null,
    ResolverComment: null,
    LeaseId: null,
    ExtensionOfLeaseId: null,
    RedemptionDeadline: null,
    CipherName: init.cipherName,
    CollectionName: init.collectionName,
    RequesterName: init.requesterName,
    RequesterEmail: init.requesterEmail,
  });
}

export const PamMockBuilders = {
  buildLease,
  buildAccessRequest,
  buildInboxAccessRequest,
};

// Deterministic predicate used by ensureSeedLease so a returning user sees the
// same demo state. Seeds an active lease for roughly one in six gated ciphers
// — enough to exercise the active-lease banner without dominating the demo.
function shouldSeedActiveLease(cipherId: string): boolean {
  return hash(cipherId) % 6 === 0;
}

function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 1000000;
}
