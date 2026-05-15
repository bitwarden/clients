import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LeaseRequestResponse, LeaseResponse, PamApiService } from "@bitwarden/pam";

import { CipherOpenInterceptorService } from "./cipher-open-interceptor.service";

describe("CipherOpenInterceptorService", () => {
  let pamApiService: jest.Mocked<Pick<PamApiService, "fetchGatedCipher">>;
  let configService: jest.Mocked<Pick<ConfigService, "getFeatureFlag">>;
  let service: CipherOpenInterceptorService;

  const cipherId = "cipher-1";
  const userId = "user-1";
  const now = new Date("2026-05-15T12:00:00Z");
  const gatedMemberships = [{ requireLease: true }];
  const ungatedMemberships = [{ requireLease: false }];

  beforeEach(() => {
    pamApiService = {
      fetchGatedCipher: jest.fn(),
    } as jest.Mocked<Pick<PamApiService, "fetchGatedCipher">>;
    configService = {
      getFeatureFlag: jest.fn().mockResolvedValue(true),
    } as jest.Mocked<Pick<ConfigService, "getFeatureFlag">>;
    service = new CipherOpenInterceptorService(
      pamApiService as unknown as PamApiService,
      configService as unknown as ConfigService,
    );
  });

  it("short-circuits to passthrough when FeatureFlag.Pam is off — no round-trip", async () => {
    configService.getFeatureFlag.mockResolvedValue(false);

    const decision = await service.open({
      cipherId,
      memberships: gatedMemberships,
      activeLeases: [],
      userId,
      now,
    });

    expect(decision).toEqual({ kind: "passthrough" });
    expect(pamApiService.fetchGatedCipher).not.toHaveBeenCalled();
    expect(configService.getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.Pam);
  });

  it("short-circuits to passthrough for unleased ciphers — no round-trip", async () => {
    const decision = await service.open({
      cipherId,
      memberships: ungatedMemberships,
      activeLeases: [],
      userId,
      now,
    });

    expect(decision).toEqual({ kind: "passthrough" });
    expect(pamApiService.fetchGatedCipher).not.toHaveBeenCalled();
  });

  it("issues exactly one GET /ciphers/{id} call for a gated_no_lease open", async () => {
    pamApiService.fetchGatedCipher.mockResolvedValue({ kind: "approved", leaseId: null } as any);

    await service.open({
      cipherId,
      memberships: gatedMemberships,
      activeLeases: [],
      userId,
      now,
    });

    expect(pamApiService.fetchGatedCipher).toHaveBeenCalledTimes(1);
    expect(pamApiService.fetchGatedCipher).toHaveBeenCalledWith(cipherId);
  });

  it("routes 200 (approved) to a reveal decision carrying the leaseId", async () => {
    pamApiService.fetchGatedCipher.mockResolvedValue({
      kind: "approved",
      cipher: {} as any,
      leaseId: "lease-9",
    });

    const decision = await service.open({
      cipherId,
      memberships: gatedMemberships,
      activeLeases: [],
      userId,
      now,
    });

    expect(decision).toEqual({ kind: "reveal", leaseId: "lease-9" });
  });

  it("routes 202 (pending) to a pending decision carrying the LeaseRequest", async () => {
    const request = { id: "req-7", status: "pending" } as unknown as LeaseRequestResponse;
    pamApiService.fetchGatedCipher.mockResolvedValue({ kind: "pending", request });

    const decision = await service.open({
      cipherId,
      memberships: gatedMemberships,
      activeLeases: [],
      userId,
      now,
    });

    expect(decision).toEqual({ kind: "pending", request });
  });

  it("routes 403 (denied) to a denied decision carrying the server reason verbatim", async () => {
    pamApiService.fetchGatedCipher.mockResolvedValue({
      kind: "denied",
      reason: "Outside allowed time window",
    });

    const decision = await service.open({
      cipherId,
      memberships: gatedMemberships,
      activeLeases: [],
      userId,
      now,
    });

    expect(decision).toEqual({ kind: "denied", reason: "Outside allowed time window" });
  });

  it("still rounds-trips a gated_active_lease open (server is the source of truth, audit log fires)", async () => {
    const activeLease = {
      cipherId,
      granteeUserId: userId,
      status: "active",
      notAfter: "2026-05-15T13:00:00Z",
    } as unknown as LeaseResponse;
    pamApiService.fetchGatedCipher.mockResolvedValue({
      kind: "approved",
      cipher: {} as any,
      leaseId: "lease-3",
    });

    const decision = await service.open({
      cipherId,
      memberships: gatedMemberships,
      activeLeases: [activeLease],
      userId,
      now,
    });

    expect(decision).toEqual({ kind: "reveal", leaseId: "lease-3" });
    expect(pamApiService.fetchGatedCipher).toHaveBeenCalledTimes(1);
  });
});
