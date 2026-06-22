import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

import {
  AccessRuleResponse,
  AccessRequestStatus,
  AccessRequestDetailsResponse,
  AccessDeciderKind,
  AccessDecisionVerdict,
  AccessEvent,
  AccessLeaseResponse,
  Decision,
} from "@bitwarden/bit-pam";

import { PamMockConfig } from "./pam-mock-config";

/**
 * DEMO ONLY — in-memory state for the PAM mock. Singleton across the app so
 * multiple components see consistent state (the modal, the pending-state
 * block, the active-leases view, etc.). Resets implicitly on page reload.
 */
@Injectable({ providedIn: "root" })
export class PamMockStore {
  /** Request id → request. */
  readonly requests = new Map<string, AccessRequestDetailsResponse>();

  /** Lease id → lease. */
  readonly leases = new Map<string, AccessLeaseResponse>();

  /** Cipher id → the latest *active* lease (if any) for the current user. */
  readonly leasesByCipher = new Map<string, AccessLeaseResponse>();

  /** Inbox requests synthesised "from other users" so the approver UI has rows. */
  readonly inboxRequests = new Map<string, AccessRequestDetailsResponse>();

  /** Access rule id → rule. Survives the session; resets on reload. */
  readonly accessRules = new Map<string, AccessRuleResponse>();

  /**
   * Organization id → engaged leasing freeze. Its presence IS the "blocked"
   * state; while one exists no approved request can be activated for that org. Keyed by
   * org id, so there is at most one per organization (AtMostOneLeasingFreezePerOrg).
   */
  readonly leasingFreezes = new Map<string, { engagedAt: string; engagedByUserId: string }>();

  /** Set when the first interceptor open fires; used to assign leases. */
  currentUserId: string | null = null;

  /** Push channel — `events$.next({ kind, requestId })` to deliver an event. */
  // eslint-disable-next-line rxjs/no-exposed-subjects -- intentional mock push channel
  readonly events$ = new Subject<AccessEvent>();

  private seededInbox = false;
  private nextId = 1;

  /** Returns a stable mock collection id for a given cipher id. */
  collectionFor(cipherId: string): string {
    return `mock-collection-${cipherId.slice(0, 8)}`;
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
      requesterId: userId,
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
   * Gated opens default to an *on-demand* request (no scheduled start); a
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
  ): AccessRequestDetailsResponse {
    this.currentUserId ??= userId;
    const id = this.mintId("req");
    const now = new Date();
    const request = buildAccessRequest({
      id,
      cipherId,
      collectionId: opts.collectionId ?? this.collectionFor(cipherId),
      organizationId: PamMockConfig.MOCK_ORG_ID,
      requesterId: userId,
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
   * id) and emit the corresponding event. Approval issues an approved request — no lease
   * is minted here; the requester activates it via {@link activateLease}.
   */
  private scheduleAutoDecide(requestId: string): void {
    setTimeout(() => {
      const request = this.requests.get(requestId);
      if (!request || request.status !== "pending") {
        // Cancelled or already decided — nothing to do.
        return;
      }
      if (PamMockConfig.shouldAutoDeny(requestId)) {
        // Auto / access-rule denial: no human approver, so no comment is surfaced (matches the server contract).
        this.denyRequest(request, null);
        return;
      }
      // Auto-approve (no human-approval condition): resolver is null.
      this.approveRequest(request, null);
    }, PamMockConfig.AUTO_DECIDE_DELAY_MS);
  }

  /**
   * Apply an approval to a pending request. An extension extends its parent
   * lease in place (ExtensionApprovedExtendsParentLease) and never mints a
   * activatable approved request; everything else becomes an approved request the
   * requester activates via {@link activateLease}. `approver` is null for an
   * auto / access-rule decision, or the deciding approver for a human decision.
   */
  approveRequest(
    request: AccessRequestDetailsResponse,
    approver: MockDecider | null,
    comment?: string,
  ): void {
    const now = new Date();
    request.resolvedAt = now.toISOString();
    // A human decision (approver set) records a human element; an auto / access-rule decision
    // (approver null) records an automatic element. The UI derives "access rule" from deciderKind.
    request.decisions = decisionsFor(approver, AccessDecisionVerdict.Approve, comment ?? null, now);

    if (request.extensionOfLeaseId != null) {
      const parent = this.leases.get(request.extensionOfLeaseId);
      if (parent == null || parent.status !== "active") {
        // ExtensionDeniedParentGone — nothing left to extend.
        request.status = "denied";
        request.decisions = decisionsFor(
          approver,
          AccessDecisionVerdict.Deny,
          "The lease being extended has ended",
          now,
        );
        this.syncInboxEntry(request.id, request);
        this.events$.next({ kind: "denied", requestId: request.id });
        return;
      }
      // ExtensionApprovedExtendsParentLease — push the parent's end out in place.
      if (request.requestedNotAfter != null) {
        parent.notAfter = request.requestedNotAfter;
      }
      request.status = "activated";
      request.producedLeaseId = parent.id;
      this.syncInboxEntry(request.id, request);
      this.events$.next({ kind: "activated", requestId: request.id });
      return;
    }

    request.status = "approved";
    // An on-demand request is bounded by the activation deadline; a scheduled
    // request is instead bounded by its requested window.
    if (isOnDemand(request, now.getTime())) {
      request.activationDeadline = new Date(
        now.getTime() + PamMockConfig.ACTIVATION_DEADLINE_MS,
      ).toISOString();
    }
    this.syncInboxEntry(request.id, request);
    this.events$.next({ kind: "approved", requestId: request.id });
  }

  /**
   * Apply a deny to a pending request: record the decision, flip to "denied", sync the inbox entry,
   * and emit. `approver` is null for an auto / access-rule denial, or the deciding approver for a
   * human decision.
   */
  denyRequest(
    request: AccessRequestDetailsResponse,
    approver: MockDecider | null,
    comment?: string,
  ): void {
    const now = new Date();
    request.status = "denied";
    request.resolvedAt = now.toISOString();
    request.decisions = decisionsFor(approver, AccessDecisionVerdict.Deny, comment ?? null, now);
    this.syncInboxEntry(request.id, request);
    this.events$.next({ kind: "denied", requestId: request.id });
  }

  /**
   * Activate an approved request (MemberStartsLease): mint the lease and move the
   * request to `activated`. Throws when the org is under a leasing freeze, the
   * rule's single-active-lease slot is taken, or the scheduled window /
   * activation deadline has lapsed — the request stays `approved` for a manual
   * retry. Extensions never reach here (they apply in place on approval).
   */
  activateLease(requestId: string): AccessLeaseResponse {
    const request = this.requests.get(requestId);
    if (request == null) {
      throw new Error(`Mock PAM: request ${requestId} not found`);
    }
    if (request.status !== "approved" || request.extensionOfLeaseId != null) {
      throw new Error("Mock PAM: request is not an activatable approved request");
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
    // re-deriving it from `nowMs` would flip a scheduled request to on-demand the
    // moment its window opened, making the scheduled branch below unreachable and
    // silently discarding the chosen window.
    const classificationRef = Date.parse(request.resolvedAt ?? request.submittedAt);
    if (!isOnDemand(request, classificationRef)) {
      // Scheduled: activatable only inside [not_before, not_after].
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
      // On-demand: activatable up to the activation deadline; runs from now.
      if (request.activationDeadline != null && nowMs > Date.parse(request.activationDeadline)) {
        throw new Error("Mock PAM: the request's activation window has passed");
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
      requesterId: request.requesterId,
      notBefore,
      notAfter,
      status: "active",
    });
    this.leases.set(lease.id, lease);
    this.leasesByCipher.set(lease.cipherId, lease);
    request.status = "activated";
    request.producedLeaseId = lease.id;
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
    const fire = (requestId: string, kind: AccessEvent["kind"]) => {
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
          ? request.activationDeadline != null && nowMs > Date.parse(request.activationDeadline)
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
        requesterId: this.mintId("user"),
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
      // Active now: an activated request whose lease window spans the present moment.
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
      // Scheduled: an activated request whose lease window starts in the future.
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
        requesterId: this.mintId("user"),
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
      // Demo decision log: a commented row reads as a human decision (renders the comment + a name in
      // the "Approved by" column); a resolved-but-comment-less row reads as an automatic / access-rule
      // decision; an expired-while-pending row never got a decision, so it stays empty.
      const verdict =
        h.status === "denied" ? AccessDecisionVerdict.Deny : AccessDecisionVerdict.Approve;
      if (h.comment) {
        inbox.decisions = [
          buildDecision({
            deciderKind: AccessDeciderKind.Human,
            id: this.mintId("user"),
            name: "Robin Manager",
            comment: h.comment,
            verdict,
            decidedAt: resolvedAt,
          }),
        ];
      } else if (h.status !== "expired") {
        inbox.decisions = [
          buildDecision({
            deciderKind: AccessDeciderKind.Automatic,
            verdict,
            decidedAt: resolvedAt,
          }),
        ];
      }
      // Mint a real lease for activated items that have an active or
      // future window so the revoke button has a leaseId to act on.
      if (h.status === "activated" && h.windowOffsetMs) {
        const lease = buildLease({
          id: this.mintId("lease"),
          requestId: id,
          cipherId,
          collectionId: this.collectionFor(cipherId),
          organizationId: PamMockConfig.MOCK_ORG_ID,
          requesterId: this.mintId("user"),
          notBefore: winStart,
          notAfter: winEnd,
          status: "active",
        });
        this.leases.set(lease.id, lease);
        inbox.producedLeaseId = lease.id;
      }
      this.inboxRequests.set(id, inbox);
    }
  }

  /**
   * Copies resolution fields from a decided {@link AccessRequestDetailsResponse} into
   * the matching inbox entry (if one exists). Called after auto-decide so the
   * history table reflects the outcome for user-submitted requests.
   */
  syncInboxEntry(requestId: string, source: AccessRequestDetailsResponse): void {
    const entry = this.inboxRequests.get(requestId);
    if (!entry) {
      return;
    }
    entry.status = source.status;
    entry.resolvedAt = source.resolvedAt;
    entry.decisions = source.decisions;
    entry.producedLeaseId = source.producedLeaseId;
  }

  mintId(prefix: string): string {
    return `${prefix}-${this.nextId++}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

/**
 * Whether a request is on-demand (activatable now, bounded by the activation
 * deadline) versus scheduled (bounded by a future window). The spec keys this
 * on `requested_not_before != null`; the mock additionally treats a "start now"
 * window (not_before at or before the reference instant) as on-demand, since
 * the request modal stamps not_before = now for preset durations.
 */
function isOnDemand(request: AccessRequestDetailsResponse, refMs: number): boolean {
  if (request.requestedNotBefore == null) {
    return true;
  }
  return Date.parse(request.requestedNotBefore) <= refMs + 60_000;
}

// --- builders ----------------------------------------------------------------
// Mint response-class instances by passing a PascalCased POJO through their
// constructors. BaseResponse.getResponseProperty handles the casing.

/** A human decider's identity for the demo. Null elsewhere means an auto / access-rule decision. */
type MockDecider = { id: string; name?: string | null; email?: string | null };

/** A request's decision log for the demo: a single human element, or a single automatic element. */
function decisionsFor(
  approver: MockDecider | null,
  verdict: AccessDecisionVerdict,
  comment: string | null,
  decidedAt: Date,
): Decision[] {
  return [
    approver == null
      ? buildDecision({ deciderKind: AccessDeciderKind.Automatic, comment, verdict, decidedAt })
      : buildDecision({
          deciderKind: AccessDeciderKind.Human,
          id: approver.id,
          name: approver.name,
          email: approver.email,
          comment,
          verdict,
          decidedAt,
        }),
  ];
}

function buildDecision(init: {
  deciderKind: AccessDeciderKind;
  id?: string | null;
  name?: string | null;
  email?: string | null;
  comment?: string | null;
  verdict: AccessDecisionVerdict;
  decidedAt: Date;
}): Decision {
  return new Decision({
    DeciderKind: init.deciderKind,
    Id: init.id ?? null,
    Name: init.name ?? null,
    Email: init.email ?? null,
    Comment: init.comment ?? null,
    Verdict: init.verdict,
    DecidedAt: init.decidedAt.toISOString(),
  });
}

function buildLease(init: {
  id: string;
  requestId: string;
  cipherId: string;
  collectionId: string;
  ruleId?: string | null;
  organizationId?: string | null;
  requesterId: string;
  notBefore: Date;
  notAfter: Date;
  status: "active" | "expired" | "revoked";
}): AccessLeaseResponse {
  return new AccessLeaseResponse({
    Id: init.id,
    RequestId: init.requestId,
    CipherId: init.cipherId,
    CollectionId: init.collectionId,
    RuleId: init.ruleId ?? null,
    OrganizationId: init.organizationId ?? null,
    GranteeUserId: init.requesterId,
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
  requesterId: string;
  status: AccessRequestStatus;
  requestedNotBefore: Date | null;
  requestedNotAfter: Date | null;
  requestedTtlSeconds: number;
  submittedAt: Date;
  resolvedAt?: Date | null;
  reason?: string;
  producedLeaseId?: string | null;
  extensionOfLeaseId?: string | null;
}): AccessRequestDetailsResponse {
  return new AccessRequestDetailsResponse({
    Id: init.id,
    CipherId: init.cipherId,
    CollectionId: init.collectionId,
    RuleId: init.ruleId ?? null,
    OrganizationId: init.organizationId ?? null,
    RequesterUserId: init.requesterId,
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
    LeaseId: init.producedLeaseId ?? null,
    ExtensionOfLeaseId: init.extensionOfLeaseId ?? null,
    RedemptionDeadline: null,
  });
}

function buildInboxAccessRequest(init: {
  id: string;
  cipherId: string;
  collectionId: string;
  requesterId: string;
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
}): AccessRequestDetailsResponse {
  return new AccessRequestDetailsResponse({
    Id: init.id,
    CipherId: init.cipherId,
    CollectionId: init.collectionId,
    RuleId: null,
    OrganizationId: PamMockConfig.MOCK_ORG_ID,
    RequesterUserId: init.requesterId,
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
