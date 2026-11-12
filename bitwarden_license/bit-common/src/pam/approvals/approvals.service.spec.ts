import { mock } from "jest-mock-extended";

import type {
  AccessRequestView,
  ApprovalsClient,
  AccessRequestsClient,
  LeasesClient,
} from "@bitwarden/sdk-internal";

import { PamInputError } from "../shared";
import { createPamSdkTestKit, PAM_TEST_USER_ID } from "../shared/testing/pam-test-helpers";

import { ApprovalsService, deriveManagedLeases, settledOutcome } from "./approvals.service";

const NOW = Date.parse("2026-06-01T12:00:00Z");
const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LEASE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function view(overrides: Partial<AccessRequestView> = {}): AccessRequestView {
  return {
    id: ID,
    cipherId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    collectionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    organizationId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    requesterId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    status: "pending",
    leaseNotBefore: "2026-06-01T11:00:00Z",
    leaseNotAfter: "2026-06-01T13:00:00Z",
    reason: "secret reason",
    submittedAt: "2026-06-01T10:00:00Z",
    decisions: [],
    awaitingActivation: false,
    requesterName: "Someone",
    requesterEmail: "someone@example.com",
    ...overrides,
  } as unknown as AccessRequestView;
}

function apiError(status: number, message: string) {
  const e = new Error(
    `error in response: status code ${status}: {"message":"${message}"}`,
  ) as Error & { variant: string };
  e.name = "ApprovalError";
  e.variant = "Api";
  return e;
}

describe("ApprovalsService", () => {
  let kit: ReturnType<typeof createPamSdkTestKit>;
  const approvals = mock<ApprovalsClient>();
  const requests = mock<AccessRequestsClient>();
  const leases = mock<LeasesClient>();
  let service: ApprovalsService;

  beforeEach(() => {
    jest.resetAllMocks();
    kit = createPamSdkTestKit();
    kit.pam.approvals.mockReturnValue(approvals);
    kit.pam.access_requests.mockReturnValue(requests);
    kit.pam.leases.mockReturnValue(leases);
    service = new ApprovalsService(kit.pamSdkService, () => NOW);
  });

  it("drops inbox rows whose window has passed and never exposes free text", async () => {
    approvals.list_inbox.mockResolvedValue([
      view(),
      view({ id: LEASE as never, leaseNotAfter: "2026-06-01T11:59:00Z" }),
    ]);
    const rows = await service.inbox(PAM_TEST_USER_ID);
    expect(rows.map((r) => r.id)).toEqual([ID]);
    expect(JSON.stringify(rows)).not.toContain("secret reason");
    expect(JSON.stringify(rows)).not.toContain("example.com");
  });

  it("returns an empty inbox for a non-approver", async () => {
    approvals.list_inbox.mockResolvedValue([]);
    expect(await service.inbox(PAM_TEST_USER_ID)).toEqual([]);
  });

  it("sends the verdict and comment, and reads back only the partial view", async () => {
    approvals.decide.mockResolvedValue(
      view({
        status: "approved",
        resolvedAt: "2026-06-01T12:00:00Z",
        humanDecision: { verdict: "approve" } as never,
      }),
    );
    const result = await service.decide(PAM_TEST_USER_ID, ID, "approve", "ok");
    expect(approvals.decide).toHaveBeenCalledWith(ID, { verdict: "approve", comment: "ok" });
    expect(result).toEqual({
      id: ID,
      status: "approved",
      resolvedAt: "2026-06-01T12:00:00Z",
      verdict: "approve",
    });
  });

  it("rejects a malformed request id before calling the SDK", async () => {
    await expect(service.decide(PAM_TEST_USER_ID, "nope", "approve", undefined)).rejects.toThrow(
      PamInputError,
    );
    expect(approvals.decide).not.toHaveBeenCalled();
  });

  it("withdraws through access_requests().cancel", async () => {
    requests.cancel.mockResolvedValue(undefined);
    await service.withdraw(PAM_TEST_USER_ID, ID);
    expect(requests.cancel).toHaveBeenCalledWith(ID);
  });

  it("ends a lease through leases().end with the reason", async () => {
    leases.end.mockResolvedValue(undefined);
    await service.revokeLease(PAM_TEST_USER_ID, LEASE, "done");
    expect(leases.end).toHaveBeenCalledWith(LEASE, { reason: "done" });
  });

  it("lists only live managed leases by default", async () => {
    approvals.list_history.mockResolvedValue([
      view({
        status: "approved",
        producedLeaseId: LEASE as never,
        producedLeaseStatus: "active",
        producedLeaseNotAfter: "2026-06-01T13:00:00Z",
      }),
      view({
        id: "11111111-1111-4111-8111-111111111112" as never,
        producedLeaseId: "11111111-1111-4111-8111-111111111113" as never,
        producedLeaseStatus: "revoked",
      }),
      view({ id: "11111111-1111-4111-8111-111111111114" as never, status: "denied" }),
    ]);
    expect((await service.managedLeases(PAM_TEST_USER_ID, false)).map((l) => l.leaseId)).toEqual([
      LEASE,
    ]);
    expect(await service.managedLeases(PAM_TEST_USER_ID, true)).toHaveLength(2);
  });

  it("marks an active lease past its window as ended", () => {
    const [lease] = deriveManagedLeases(
      [
        view({
          producedLeaseId: LEASE as never,
          producedLeaseStatus: "active",
          producedLeaseNotAfter: "2026-06-01T11:00:00Z",
        }),
      ],
      NOW,
    );
    expect(lease.liveness).toBe("ended");
  });
});

describe("settledOutcome", () => {
  it("recognises an already-resolved conflict", () => {
    expect(settledOutcome(apiError(409, "This request has already been resolved."))).toBe(
      "already-resolved",
    );
  });

  it("recognises a window that ended", () => {
    expect(settledOutcome(apiError(409, "This request's window has already ended."))).toBe(
      "window-ended",
    );
  });

  it("does not treat other failures as settled", () => {
    expect(settledOutcome(apiError(403, "Nope"))).toBeUndefined();
    expect(settledOutcome(new Error("boom"))).toBeUndefined();
  });
});
