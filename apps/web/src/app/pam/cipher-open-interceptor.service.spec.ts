import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { AccessRequestDetailsResponse, PamApiService } from "@bitwarden/pam";

import { CipherOpenInterceptorService } from "./cipher-open-interceptor.service";

describe("CipherOpenInterceptorService", () => {
  let pamApiService: jest.Mocked<Pick<PamApiService, "fetchGatedCipher">>;
  let configService: jest.Mocked<Pick<ConfigService, "getFeatureFlag">>;
  let service: CipherOpenInterceptorService;

  const cipherId = "cipher-1";
  const userId = "user-1";

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
      gated: true,
      userId,
    });

    expect(decision).toEqual({ kind: "passthrough" });
    expect(pamApiService.fetchGatedCipher).not.toHaveBeenCalled();
    expect(configService.getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.Pam);
  });

  it("short-circuits to passthrough for non-gated ciphers — no round-trip", async () => {
    const decision = await service.open({
      cipherId,
      gated: false,
      userId,
    });

    expect(decision).toEqual({ kind: "passthrough" });
    expect(pamApiService.fetchGatedCipher).not.toHaveBeenCalled();
  });

  it("issues exactly one GET /ciphers/{id} call for a gated_no_lease open", async () => {
    pamApiService.fetchGatedCipher.mockResolvedValue({ kind: "approved", leaseId: null } as any);

    await service.open({
      cipherId,
      gated: true,
      userId,
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
      gated: true,
      userId,
    });

    expect(decision).toEqual({ kind: "reveal", leaseId: "lease-9" });
  });

  it("routes 202 (pending) to a pending decision carrying the AccessRequest", async () => {
    const request = { id: "req-7", status: "pending" } as unknown as AccessRequestDetailsResponse;
    pamApiService.fetchGatedCipher.mockResolvedValue({ kind: "pending", request });

    const decision = await service.open({
      cipherId,
      gated: true,
      userId,
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
      gated: true,
      userId,
    });

    expect(decision).toEqual({ kind: "denied", reason: "Outside allowed time window" });
  });

  it("round-trips every gated open — the server decides, even when a lease may already be held", async () => {
    pamApiService.fetchGatedCipher.mockResolvedValue({
      kind: "approved",
      cipher: {} as any,
      leaseId: "lease-3",
    });

    const decision = await service.open({
      cipherId,
      gated: true,
      userId,
    });

    expect(decision).toEqual({ kind: "reveal", leaseId: "lease-3" });
    expect(pamApiService.fetchGatedCipher).toHaveBeenCalledTimes(1);
  });
});
