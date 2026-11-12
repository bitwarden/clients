import { mock } from "jest-mock-extended";

import type {
  AccessLeaseView,
  AccessRequestView,
  CipherAccessStateView,
  CipherView,
  LeasesClient,
  AccessRequestsClient,
} from "@bitwarden/sdk-internal";

import { createPamSdkTestKit, PAM_TEST_USER_ID } from "../shared/testing/pam-test-helpers";

import { ACCESS_NOT_AVAILABLE_MESSAGE, LeasesService } from "./leases.service";

const LEASE_ID = "33333333-3333-4333-8333-333333333333";
const CIPHER_ID = "44444444-4444-4444-8444-444444444444";
const NOW = Date.parse("2026-03-01T12:00:00Z");

const lease = (overrides: Partial<AccessLeaseView> = {}): AccessLeaseView =>
  ({
    id: LEASE_ID,
    requestId: "55555555-5555-4555-8555-555555555555",
    cipherId: CIPHER_ID,
    collectionId: "66666666-6666-4666-8666-666666666666",
    status: "active",
    notBefore: "2026-03-01T11:00:00Z",
    notAfter: "2026-03-01T13:00:00Z",
    ...overrides,
  }) as unknown as AccessLeaseView;

const state = (overrides: Partial<CipherAccessStateView> = {}): CipherAccessStateView =>
  ({
    cipherId: CIPHER_ID,
    activeLease: lease(),
    extensionsAllowed: true,
    maxExtensionDurationSeconds: 3600,
    ...overrides,
  }) as unknown as CipherAccessStateView;

describe("LeasesService", () => {
  let kit: ReturnType<typeof createPamSdkTestKit>;
  const leases = mock<LeasesClient>();
  const accessRequests = mock<AccessRequestsClient>();
  let service: LeasesService;

  beforeEach(() => {
    jest.clearAllMocks();
    kit = createPamSdkTestKit();
    kit.pam.leases.mockReturnValue(leases);
    kit.pam.access_requests.mockReturnValue(accessRequests);
    service = new LeasesService(kit.pamSdkService, () => NOW);
  });

  describe("list", () => {
    it("lists every lease without --active", async () => {
      leases.list_mine.mockResolvedValue([lease()]);
      expect(await service.list(PAM_TEST_USER_ID, false)).toHaveLength(1);
      expect(leases.list_active).not.toHaveBeenCalled();
    });

    it("drops lapsed leases with --active", async () => {
      leases.list_mine.mockResolvedValue([lease(), lease({ notAfter: "2026-03-01T11:59:00Z" })]);
      expect(await service.list(PAM_TEST_USER_ID, true)).toHaveLength(1);
    });

    it("drops leases that are not active with --active", async () => {
      leases.list_mine.mockResolvedValue([lease(), lease({ status: "revoked" })]);
      expect(await service.list(PAM_TEST_USER_ID, true)).toHaveLength(1);
    });

    // The server answers list_active with the leases on collections the caller can manage, so it is
    // empty for an ordinary holder. Only the caller's own leases may decide what is live.
    it("never reads list_active, which is the approver view", async () => {
      leases.list_mine.mockResolvedValue([lease()]);
      leases.list_active.mockResolvedValue([]);
      expect(await service.list(PAM_TEST_USER_ID, true)).toHaveLength(1);
      expect(leases.list_active).not.toHaveBeenCalled();
    });
  });

  describe("extend", () => {
    const extended = {
      id: "77777777-7777-4777-8777-777777777777",
      status: "approved",
      leaseNotAfter: "2026-03-01T14:00:00Z",
    };

    beforeEach(() => {
      leases.list_mine.mockResolvedValue([lease()]);
      accessRequests.cipher_access_state.mockResolvedValue(state());
      leases.extend.mockResolvedValue(extended as unknown as AccessRequestView);
    });

    it("extends within the maximum and returns ids and state only", async () => {
      const result = await service.extend(PAM_TEST_USER_ID, LEASE_ID, 1800, "Still deploying");

      expect(leases.extend).toHaveBeenCalledWith(LEASE_ID, {
        durationSeconds: 1800,
        reason: "Still deploying",
      });
      expect(result).toEqual({
        leaseId: LEASE_ID,
        requestId: extended.id,
        status: "approved",
        notAfter: extended.leaseNotAfter,
      });
    });

    it("refuses an empty reason before calling the SDK", async () => {
      await expect(service.extend(PAM_TEST_USER_ID, LEASE_ID, 60, "  ")).rejects.toThrow(
        "A reason is required",
      );
      expect(leases.list_mine).not.toHaveBeenCalled();
    });

    it("refuses a duration over maxExtensionDurationSeconds", async () => {
      await expect(service.extend(PAM_TEST_USER_ID, LEASE_ID, 3601, "why")).rejects.toThrow(
        "cannot be longer than 3600 seconds",
      );
      expect(leases.extend).not.toHaveBeenCalled();
    });

    it("refuses when extensions are not allowed", async () => {
      accessRequests.cipher_access_state.mockResolvedValue(state({ extensionsAllowed: false }));
      await expect(service.extend(PAM_TEST_USER_ID, LEASE_ID, 60, "why")).rejects.toThrow(
        "cannot be extended",
      );
      expect(leases.extend).not.toHaveBeenCalled();
    });

    it("says the lease ended when it is not among the live leases", async () => {
      leases.list_mine.mockResolvedValue([lease({ notAfter: "2026-03-01T11:00:00Z" })]);
      await expect(service.extend(PAM_TEST_USER_ID, LEASE_ID, 60, "why")).rejects.toThrow(
        "The lease has ended",
      );
    });

    it("extends a lease the caller holds without consulting list_active", async () => {
      leases.list_active.mockResolvedValue([]);
      await service.extend(PAM_TEST_USER_ID, LEASE_ID, 60, "why");
      expect(leases.list_active).not.toHaveBeenCalled();
      expect(leases.extend).toHaveBeenCalled();
    });

    it("treats a resolved denied status as an ended lease", async () => {
      leases.extend.mockResolvedValue({
        ...extended,
        status: "denied",
      } as unknown as AccessRequestView);
      await expect(service.extend(PAM_TEST_USER_ID, LEASE_ID, 60, "why")).rejects.toThrow(
        "The lease has ended",
      );
    });

    it("rejects a lease id that is not a GUID", async () => {
      await expect(service.extend(PAM_TEST_USER_ID, "nope", 60, "why")).rejects.toThrow(
        "not a valid lease id",
      );
    });
  });

  describe("end", () => {
    it("ends the lease with an optional reason", async () => {
      leases.end.mockResolvedValue(undefined);
      expect(await service.end(PAM_TEST_USER_ID, LEASE_ID.toUpperCase(), undefined)).toBe(LEASE_ID);
      expect(leases.end).toHaveBeenCalledWith(LEASE_ID, { reason: undefined });
    });
  });

  describe("reveal", () => {
    const view = (overrides: Partial<CipherView> = {}): CipherView =>
      ({
        id: CIPHER_ID,
        partial: false,
        type: 1,
        name: "n",
        notes: "the notes",
        login: { username: "root", password: "hunter2", uris: [{ uri: "https://a.test" }] },
        ...overrides,
      }) as unknown as CipherView;

    beforeEach(() => {
      accessRequests.cipher_access_state.mockResolvedValue(state());
      leases.leased_cipher.mockResolvedValue(view());
    });

    it.each([
      ["password", "hunter2"],
      ["username", "root"],
      ["notes", "the notes"],
      ["uri", "https://a.test"],
    ] as const)("returns only the %s field", async (field, expected) => {
      expect(await service.reveal(PAM_TEST_USER_ID, CIPHER_ID, field)).toBe(expected);
    });

    it("fails closed when leased_cipher returns undefined", async () => {
      leases.leased_cipher.mockResolvedValue(undefined);
      await expect(service.reveal(PAM_TEST_USER_ID, CIPHER_ID, "password")).rejects.toThrow(
        ACCESS_NOT_AVAILABLE_MESSAGE,
      );
    });

    it.each([[{ partial: true }], [{ partial: undefined }]])(
      "fails closed unless the view is explicitly not partial (%p)",
      async (overrides) => {
        leases.leased_cipher.mockResolvedValue(view(overrides as Partial<CipherView>));
        await expect(service.reveal(PAM_TEST_USER_ID, CIPHER_ID, "password")).rejects.toThrow(
          ACCESS_NOT_AVAILABLE_MESSAGE,
        );
      },
    );

    it("fails closed on an id mismatch", async () => {
      leases.leased_cipher.mockResolvedValue(
        view({ id: "88888888-8888-4888-8888-888888888888" as unknown as CipherView["id"] }),
      );
      await expect(service.reveal(PAM_TEST_USER_ID, CIPHER_ID, "password")).rejects.toThrow(
        ACCESS_NOT_AVAILABLE_MESSAGE,
      );
    });

    it("fails closed without a live lease and never reads the cipher", async () => {
      accessRequests.cipher_access_state.mockResolvedValue(
        state({ activeLease: lease({ notAfter: "2026-03-01T11:00:00Z" }) }),
      );
      await expect(service.reveal(PAM_TEST_USER_ID, CIPHER_ID, "password")).rejects.toThrow(
        ACCESS_NOT_AVAILABLE_MESSAGE,
      );
      expect(leases.leased_cipher).not.toHaveBeenCalled();
    });

    it("does not put the secret in a failure or a log", async () => {
      leases.leased_cipher.mockResolvedValue(
        view({ login: { password: " " } as CipherView["login"] }),
      );
      await expect(service.reveal(PAM_TEST_USER_ID, CIPHER_ID, "password")).rejects.toThrow(
        "No password available",
      );
      expect(JSON.stringify(kit.logService.error.mock.calls)).not.toContain("hunter2");
    });
  });
});
