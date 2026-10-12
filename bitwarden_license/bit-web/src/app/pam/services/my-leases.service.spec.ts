import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import type { AccessLeaseView } from "../abstractions/access-lease";
import { AccessLeaseSdkService } from "../abstractions/access-lease-sdk.service";

import { MyLeasesService } from "./my-leases.service";

/** Only the three fields the gate reads; the SDK view is wide and entirely server-populated. */
function leaseView(overrides: Partial<AccessLeaseView> = {}): AccessLeaseView {
  return {
    id: "lease-1",
    cipherId: "cipher-1",
    status: "active",
    ...overrides,
  } as unknown as AccessLeaseView;
}

describe("MyLeasesService", () => {
  let leasesApi: MockProxy<AccessLeaseSdkService>;
  let logService: MockProxy<LogService>;
  let sut: MyLeasesService;

  beforeEach(() => {
    leasesApi = mock<AccessLeaseSdkService>();
    logService = mock<LogService>();
    leasesApi.listMyLeases.mockResolvedValue([leaseView()]);
    sut = new MyLeasesService(leasesApi, logService);
  });

  it("reports a live lease on the cipher", async () => {
    expect(await firstValueFrom(sut.hasActiveLease$("cipher-1"))).toBe(true);
  });

  it("does not report a lease on another cipher", async () => {
    expect(await firstValueFrom(sut.hasActiveLease$("cipher-2"))).toBe(false);
  });

  it.each(["expired", "revoked", "canceled"])("does not report a %s lease", async (status) => {
    leasesApi.listMyLeases.mockResolvedValue([leaseView({ status } as Partial<AccessLeaseView>)]);

    expect(await firstValueFrom(sut.hasActiveLease$("cipher-1"))).toBe(false);
  });

  it("serves repeated reads from one call", async () => {
    await firstValueFrom(sut.hasActiveLease$("cipher-1"));
    await firstValueFrom(sut.hasActiveLease$("cipher-1"));
    await firstValueFrom(sut.leases$());

    expect(leasesApi.listMyLeases).toHaveBeenCalledTimes(1);
  });

  it("re-reads after invalidate, so an ended lease stops opening the gate", async () => {
    expect(await firstValueFrom(sut.hasActiveLease$("cipher-1"))).toBe(true);
    leasesApi.listMyLeases.mockResolvedValue([]);

    sut.invalidate();

    expect(await firstValueFrom(sut.hasActiveLease$("cipher-1"))).toBe(false);
    expect(leasesApi.listMyLeases).toHaveBeenCalledTimes(2);
  });

  it("leaves the gate shut when the read fails", async () => {
    leasesApi.listMyLeases.mockRejectedValue(new Error("boom"));

    expect(await firstValueFrom(sut.hasActiveLease$("cipher-1"))).toBe(false);
    expect(logService.error).toHaveBeenCalled();
  });

  describe("leasedCipherIds", () => {
    const live = new Date(Date.now() + 60_000).toISOString();

    it("reports the ciphers under a live lease", async () => {
      leasesApi.listMyLeases.mockResolvedValue([leaseView({ notAfter: live })]);

      await expect(sut.leasedCipherIds()).resolves.toEqual(new Set(["cipher-1"]));
    });

    it("drops a lapsed or ended lease", async () => {
      leasesApi.listMyLeases.mockResolvedValue([
        leaseView({ notAfter: new Date(Date.now() - 1).toISOString() }),
        leaseView({ status: "revoked", notAfter: live }),
      ]);

      await expect(sut.leasedCipherIds()).resolves.toEqual(new Set());
    });

    it("reads fresh even when the cache is warm", async () => {
      await firstValueFrom(sut.leases$());
      leasesApi.listMyLeases.mockResolvedValue([]);

      await expect(sut.leasedCipherIds()).resolves.toEqual(new Set());
      expect(leasesApi.listMyLeases).toHaveBeenCalledTimes(2);
    });

    it("fails closed when the read fails", async () => {
      leasesApi.listMyLeases.mockRejectedValue(new Error("boom"));

      await expect(sut.leasedCipherIds()).resolves.toEqual(new Set());
      expect(logService.error).toHaveBeenCalled();
    });
  });
});
