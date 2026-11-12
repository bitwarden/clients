import { mock, MockProxy } from "jest-mock-extended";

import { AccessRequestsService } from "@bitwarden/bit-common/pam/requests";
import { PAM_TEST_USER_ID } from "@bitwarden/bit-common/pam/shared/testing/pam-test-helpers";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { RequestOperations } from "./request.operations";

const CIPHER = "44444444-4444-4444-8444-444444444444";
const REQUEST = "55555555-5555-4555-8555-555555555555";
const LEASE = "66666666-6666-4666-8666-666666666666";
const NOW = new Date("2026-03-01T12:00:00Z");

function view(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST,
    cipherId: CIPHER,
    collectionId: "col",
    organizationId: "org",
    requesterId: "u",
    status: "approved",
    leaseNotBefore: "2026-03-01T09:00:00Z",
    leaseNotAfter: "2026-03-01T17:00:00Z",
    reason: "secret-reason",
    requesterName: "Alice Example",
    requesterEmail: "alice@example.com",
    submittedAt: "2026-03-01T08:00:00Z",
    decisions: [{ comment: "secret-comment" }],
    awaitingActivation: true,
    ...overrides,
  };
}

function preCheck(overrides: Record<string, unknown> = {}) {
  return {
    cipherId: CIPHER,
    approvalMode: "automatic",
    hasActiveLease: false,
    defaultDurationSeconds: 3600,
    maxDurationSeconds: 7200,
    canStartLease: true,
    slotFreesAt: undefined as string | undefined,
    ...overrides,
  };
}

describe("RequestOperations", () => {
  let requests: MockProxy<AccessRequestsService>;
  let operations: RequestOperations;
  const names = {
    cipher: (id: string) => `name-of-${id}`,
    collection: (id: string) => id,
    organization: (id: string) => `org-${id}`,
  };

  beforeEach(() => {
    requests = mock<AccessRequestsService>();
    operations = new RequestOperations(
      requests,
      async () => names,
      () => NOW,
    );
  });

  describe("status", () => {
    const state = (overrides: Record<string, unknown> = {}) => ({
      cipherId: CIPHER,
      activeLease: undefined as unknown,
      pendingRequest: undefined as unknown,
      approvedRequest: undefined as unknown,
      badgeState: "privileged",
      extensionsAllowed: false,
      maxExtensionDurationSeconds: undefined as number | undefined,
      ...overrides,
    });

    it("prints the state without a pre-check by default", async () => {
      requests.cipherAccessState.mockResolvedValue(state() as never);

      const response = await operations.status(PAM_TEST_USER_ID, CIPHER, {});

      expect(response.success).toBe(true);
      expect(response.data).toMatchObject({ object: "pam-access-state", badgeState: "privileged" });
      expect(requests.preCheck).not.toHaveBeenCalled();
    });

    it("adds the pre-check view with --precheck", async () => {
      requests.cipherAccessState.mockResolvedValue(state() as never);
      requests.preCheck.mockResolvedValue(
        preCheck({ canStartLease: false, slotFreesAt: "2026-03-01T13:00:00Z" }) as never,
      );

      const response = await operations.status(PAM_TEST_USER_ID, CIPHER, { precheck: true });

      expect(response.data).toMatchObject({
        approvalMode: "automatic",
        defaultDurationSeconds: 3600,
        maxDurationSeconds: 7200,
        canStartLease: false,
        slotFreesAt: "2026-03-01T13:00:00.000Z",
      });
    });

    it("never re-ranks the badge, and flattens an active one", async () => {
      requests.cipherAccessState.mockResolvedValue(
        state({
          badgeState: { active: { expiresAt: "2026-03-01T15:00:00Z" } },
          pendingRequest: view({ id: "pending" }),
          activeLease: { id: LEASE, notAfter: "2026-03-01T15:00:00Z" },
          extensionsAllowed: true,
          maxExtensionDurationSeconds: 600,
        }) as never,
      );

      const response = await operations.status(PAM_TEST_USER_ID, CIPHER, {});

      expect(response.data).toMatchObject({
        badgeState: "active",
        badgeExpiresAt: "2026-03-01T15:00:00.000Z",
        activeLeaseId: LEASE,
        pendingRequestId: "pending",
        extensionsAllowed: true,
        maxExtensionDurationSeconds: 600,
      });
    });

    it("reports a lapsed active lease as lapsed, not live", async () => {
      requests.cipherAccessState.mockResolvedValue(
        state({
          badgeState: { active: { expiresAt: "2026-03-01T11:00:00Z" } },
          activeLease: { id: LEASE, notAfter: "2026-03-01T11:00:00Z" },
          extensionsAllowed: true,
          maxExtensionDurationSeconds: 600,
        }) as never,
      );

      const response = await operations.status(PAM_TEST_USER_ID, CIPHER, {});

      expect(response.data).toMatchObject({ activeLeaseLapsed: true, extensionsAllowed: false });
      expect(
        (response.data as unknown as { activeLeaseId?: string }).activeLeaseId,
      ).toBeUndefined();
    });

    it("prints names only with --names", async () => {
      requests.cipherAccessState.mockResolvedValue(state() as never);

      const plain = await operations.status(PAM_TEST_USER_ID, CIPHER, {});
      const named = await operations.status(PAM_TEST_USER_ID, CIPHER, { names: true });

      expect((plain.data as unknown as { cipherName?: string }).cipherName).toBeUndefined();
      expect((named.data as unknown as { cipherName?: string }).cipherName).toBe(
        `name-of-${CIPHER}`,
      );
    });

    it("refuses a bad cipher id locally", async () => {
      await expect(operations.status(PAM_TEST_USER_ID, "x", {})).rejects.toThrow("cipher id");
      expect(requests.cipherAccessState).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    const created = (status = "approved") => ({
      approvalMode: "automatic",
      request: {
        id: REQUEST,
        cipherId: CIPHER,
        collectionId: "col",
        organizationId: "org",
        status,
        leaseNotBefore: "2026-03-01T12:00:00Z",
        leaseNotAfter: "2026-03-01T13:00:00Z",
        reason: "secret-reason",
        submittedAt: "2026-03-01T12:00:00Z",
      },
    });

    it("runs the pre-check first and takes the automatic path", async () => {
      requests.preCheck.mockResolvedValue(preCheck() as never);
      requests.request.mockResolvedValue(created() as never);

      const response = await operations.create(PAM_TEST_USER_ID, {
        cipherId: CIPHER,
        duration: "30m",
      });

      expect(requests.request).toHaveBeenCalledWith(PAM_TEST_USER_ID, CIPHER, {
        durationSeconds: 1800,
        start: undefined,
        end: undefined,
        reason: undefined,
      });
      expect(response.data).toMatchObject({
        object: "pam-request",
        id: REQUEST,
        approvalMode: "automatic",
      });
      expect((response.data as unknown as { nextStep: string }).nextStep).toContain(
        `bw privileged-controls request activate ${REQUEST}`,
      );
      expect((response.data as unknown as { warning?: string }).warning).toBeUndefined();
    });

    it("never mints a lease and never prints the reason", async () => {
      requests.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }) as never);
      requests.request.mockResolvedValue(created("pending") as never);

      const response = await operations.create(PAM_TEST_USER_ID, {
        cipherId: CIPHER,
        start: "2026-03-01T13:00:00Z",
        end: "2026-03-01T14:00:00Z",
        reason: "secret-reason",
      });

      expect(requests.activate).not.toHaveBeenCalled();
      expect(JSON.stringify(response)).not.toContain("secret-reason");
      expect((response.data as unknown as { nextStep: string }).nextStep).toContain("activate");
    });

    it("warns, without naming a holder, when the slot is busy", async () => {
      requests.preCheck.mockResolvedValue(preCheck({ canStartLease: false }) as never);
      requests.request.mockResolvedValue(created() as never);

      const response = await operations.create(PAM_TEST_USER_ID, { cipherId: CIPHER });

      const warning = (response.data as unknown as { warning?: string }).warning;
      expect(warning).toContain("single active lease");
      expect(requests.request).toHaveBeenCalled();
    });

    it("refuses mixed flags before any request", async () => {
      await expect(
        operations.create(PAM_TEST_USER_ID, {
          cipherId: CIPHER,
          duration: "1h",
          start: "2026-03-01T13:00:00Z",
          end: "2026-03-01T14:00:00Z",
        }),
      ).rejects.toThrow("not both");
      expect(requests.preCheck).not.toHaveBeenCalled();
    });

    it("refuses a missing reason on the human path without sending", async () => {
      requests.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }) as never);

      await expect(
        operations.create(PAM_TEST_USER_ID, {
          cipherId: CIPHER,
          start: "2026-03-01T13:00:00Z",
          end: "2026-03-01T14:00:00Z",
        }),
      ).rejects.toThrow("reason is required");
      expect(requests.request).not.toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("writes a list of flat rows without free text", async () => {
      requests.listMine.mockResolvedValue([
        view({ producedLeaseId: LEASE, producedLeaseStatus: "active" }),
        view({ id: "ext", extensionOfLeaseId: LEASE, status: "pending" }),
      ] as never);

      const response = await operations.list(PAM_TEST_USER_ID, {});

      expect(response.data).toBeInstanceOf(ListResponse);
      const rows = (response.data as ListResponse).data as unknown as Record<string, unknown>[];
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        status: "approved",
        producedLeaseId: LEASE,
        producedLeaseStatus: "active",
        extensionRequestIds: ["ext"],
        extensionPending: true,
      });
      const text = JSON.stringify(response);
      for (const secret of ["secret-reason", "secret-comment", "alice@example.com", "Alice"]) {
        expect(text).not.toContain(secret);
      }
    });

    it("filters by status and refuses a bad one", async () => {
      requests.listMine.mockResolvedValue([view()] as never);

      const none = await operations.list(PAM_TEST_USER_ID, { status: "pending" });

      expect(((none.data as ListResponse).data as unknown[]).length).toBe(0);
      await expect(operations.list(PAM_TEST_USER_ID, { status: "cancelled" })).rejects.toThrow(
        "one L",
      );
    });
  });

  describe("get, activate and cancel", () => {
    it("gets a request", async () => {
      requests.get.mockResolvedValue(view() as never);

      const response = await operations.get(PAM_TEST_USER_ID, REQUEST.toUpperCase(), {});

      expect(requests.get).toHaveBeenCalledWith(PAM_TEST_USER_ID, REQUEST);
      expect(response.data).toMatchObject({ object: "pam-request", id: REQUEST });
    });

    it("activates and prints the lease without a credential", async () => {
      requests.activate.mockResolvedValue({
        id: LEASE,
        requestId: REQUEST,
        cipherId: CIPHER,
        collectionId: "col",
        organizationId: "org",
        requesterId: "u",
        status: "active",
        notBefore: "2026-03-01T12:00:00Z",
        notAfter: "2026-03-01T13:00:00Z",
        termination: undefined,
      } as never);

      const response = await operations.activate(PAM_TEST_USER_ID, REQUEST);

      expect(response.data).toMatchObject({
        object: "pam-lease",
        leaseId: LEASE,
        status: "active",
      });
      expect(Object.keys(response.data as object)).not.toContain("password");
    });

    it("cancels with one L", async () => {
      requests.cancel.mockResolvedValue(undefined);

      const response = await operations.cancel(PAM_TEST_USER_ID, REQUEST);

      expect(requests.cancel).toHaveBeenCalledWith(PAM_TEST_USER_ID, REQUEST);
      expect(JSON.stringify(response)).toContain("canceled");
    });
  });
});
