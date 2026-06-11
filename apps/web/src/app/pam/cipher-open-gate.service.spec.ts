import { of, throwError } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import {
  AccessRequestDetailsResponse,
  LeasedCipherFetcher,
  PamApiService,
  RequestAccessTrigger,
} from "@bitwarden/pam";

import { PamCipherOpenGate } from "./cipher-open-gate.service";

describe("PamCipherOpenGate", () => {
  let configService: jest.Mocked<Pick<ConfigService, "getFeatureFlag">>;
  let fetcher: jest.Mocked<Pick<LeasedCipherFetcher, "fetch">>;
  let trigger: jest.Mocked<Pick<RequestAccessTrigger, "requestAccess">>;
  let pamApiService: jest.Mocked<Pick<PamApiService, "getCipherAccessState$" | "activateLease">>;
  let logService: jest.Mocked<Pick<LogService, "error">>;
  let gate: PamCipherOpenGate;

  beforeEach(() => {
    configService = { getFeatureFlag: jest.fn().mockResolvedValue(true) };
    fetcher = { fetch: jest.fn() };
    trigger = { requestAccess: jest.fn() };
    pamApiService = {
      getCipherAccessState$: jest.fn().mockReturnValue(of({})),
      activateLease: jest.fn(),
    };
    logService = { error: jest.fn() };
    gate = new PamCipherOpenGate(
      configService as unknown as ConfigService,
      fetcher as unknown as LeasedCipherFetcher,
      trigger as unknown as RequestAccessTrigger,
      pamApiService as unknown as PamApiService,
      logService as unknown as LogService,
    );
  });

  const partial = { id: "cipher-1", partialData: '{"Name":"n"}' };
  const notGated = { id: "cipher-1", partialData: undefined };

  const approvedRequest = (overrides?: Partial<AccessRequestDetailsResponse>) =>
    ({
      id: "request-1",
      status: "approved",
      requestedNotBefore: new Date(Date.now() - 60_000).toISOString(),
      requestedNotAfter: new Date(Date.now() + 3_600_000).toISOString(),
      ...overrides,
    }) as AccessRequestDetailsResponse;

  it("short-circuits to 'open' when partialData is null (not gated / lease already covers it)", async () => {
    const verdict = await gate.check(notGated, "user-1");
    expect(verdict).toBe("open");
    expect(fetcher.fetch).not.toHaveBeenCalled();
    expect(trigger.requestAccess).not.toHaveBeenCalled();
  });

  it("short-circuits to 'open' when the PAM flag is off — no fetch, no modal", async () => {
    configService.getFeatureFlag.mockResolvedValue(false);

    const verdict = await gate.check(partial, "user-1");

    expect(verdict).toBe("open");
    expect(configService.getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.Pam);
    expect(fetcher.fetch).not.toHaveBeenCalled();
    expect(trigger.requestAccess).not.toHaveBeenCalled();
  });

  it("returns 'openWith' when the lease fetch succeeds — no state read, no request-access modal", async () => {
    const fresh = { id: "cipher-1" } as Cipher;
    fetcher.fetch.mockResolvedValue(fresh);

    const verdict = await gate.check(partial, "user-1");

    expect(verdict).toEqual({ kind: "openWith", cipher: fresh });
    expect(fetcher.fetch).toHaveBeenCalledWith("cipher-1");
    expect(pamApiService.getCipherAccessState$).not.toHaveBeenCalled();
    expect(trigger.requestAccess).not.toHaveBeenCalled();
  });

  it("opens the partial view for an approved request — never mints the lease; the banner owns the explicit start", async () => {
    fetcher.fetch.mockResolvedValue(null);
    pamApiService.getCipherAccessState$.mockReturnValue(of({ approvedRequest: approvedRequest() }));

    const verdict = await gate.check(partial, "user-1");

    // Activation is an explicit member action (the cipher-lease banner's "Start access" button),
    // never a side-effect of opening the item.
    expect(verdict).toBe("open");
    expect(pamApiService.activateLease).not.toHaveBeenCalled();
    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
    expect(trigger.requestAccess).not.toHaveBeenCalled();
  });

  it("opens — never activates — even when the approved request's scheduled window is already open", async () => {
    fetcher.fetch.mockResolvedValue(null);
    pamApiService.getCipherAccessState$.mockReturnValue(
      of({
        approvedRequest: approvedRequest({
          requestedNotBefore: new Date(Date.now() - 3_600_000).toISOString(),
        }),
      }),
    );

    const verdict = await gate.check(partial, "user-1");

    expect(verdict).toBe("open");
    expect(pamApiService.activateLease).not.toHaveBeenCalled();
    expect(trigger.requestAccess).not.toHaveBeenCalled();
  });

  it("falls through to the request flow when the snapshot only holds a pending request", async () => {
    fetcher.fetch.mockResolvedValue(null);
    pamApiService.getCipherAccessState$.mockReturnValue(
      of({ pendingRequest: { id: "request-1" } as AccessRequestDetailsResponse }),
    );
    trigger.requestAccess.mockResolvedValue("request-created");

    const verdict = await gate.check(partial, "user-1");

    expect(verdict).toBe("handled");
    expect(pamApiService.activateLease).not.toHaveBeenCalled();
    expect(trigger.requestAccess).toHaveBeenCalledWith("cipher-1");
  });

  it("falls through to the request flow when the snapshot read fails", async () => {
    fetcher.fetch.mockResolvedValue(null);
    pamApiService.getCipherAccessState$.mockReturnValue(throwError(() => new Error("offline")));
    trigger.requestAccess.mockResolvedValue("dismissed");

    const verdict = await gate.check(partial, "user-1");

    expect(verdict).toBe("handled");
    expect(logService.error).toHaveBeenCalled();
    expect(trigger.requestAccess).toHaveBeenCalledWith("cipher-1");
  });

  it("triggers the request flow on 404, retries the fetch on lease-created, returns openWith", async () => {
    const fresh = { id: "cipher-1" } as Cipher;
    fetcher.fetch.mockResolvedValueOnce(null).mockResolvedValueOnce(fresh);
    trigger.requestAccess.mockResolvedValue("lease-created");

    const verdict = await gate.check(partial, "user-1");

    expect(verdict).toEqual({ kind: "openWith", cipher: fresh });
    expect(fetcher.fetch).toHaveBeenCalledTimes(2);
    expect(trigger.requestAccess).toHaveBeenCalledWith("cipher-1");
  });

  it("returns 'handled' if the post-lease re-fetch comes back empty (lease evaporated)", async () => {
    fetcher.fetch.mockResolvedValue(null);
    trigger.requestAccess.mockResolvedValue("lease-created");

    const verdict = await gate.check(partial, "user-1");

    expect(verdict).toBe("handled");
    expect(fetcher.fetch).toHaveBeenCalledTimes(2);
  });

  it("returns 'handled' when the modal creates a pending human-approval request", async () => {
    fetcher.fetch.mockResolvedValue(null);
    trigger.requestAccess.mockResolvedValue("request-created");

    const verdict = await gate.check(partial, "user-1");

    expect(verdict).toBe("handled");
    // No re-fetch attempt — no lease was issued.
    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns 'handled' when the user dismisses the modal", async () => {
    fetcher.fetch.mockResolvedValue(null);
    trigger.requestAccess.mockResolvedValue("dismissed");

    const verdict = await gate.check(partial, "user-1");

    expect(verdict).toBe("handled");
    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
  });
});
