import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { LeasedCipherFetcher, RequestAccessTrigger } from "@bitwarden/pam";

import { PamCipherOpenGate } from "./cipher-open-gate.service";

describe("PamCipherOpenGate", () => {
  let configService: jest.Mocked<Pick<ConfigService, "getFeatureFlag">>;
  let fetcher: jest.Mocked<Pick<LeasedCipherFetcher, "fetch">>;
  let trigger: jest.Mocked<Pick<RequestAccessTrigger, "requestAccess">>;
  let gate: PamCipherOpenGate;

  beforeEach(() => {
    configService = { getFeatureFlag: jest.fn().mockResolvedValue(true) };
    fetcher = { fetch: jest.fn() };
    trigger = { requestAccess: jest.fn() };
    gate = new PamCipherOpenGate(
      configService as unknown as ConfigService,
      fetcher as unknown as LeasedCipherFetcher,
      trigger as unknown as RequestAccessTrigger,
    );
  });

  const partial = { id: "cipher-1", partialData: '{"Name":"n"}' };
  const notGated = { id: "cipher-1", partialData: undefined };

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

  it("returns 'openWith' when the lease fetch succeeds — no request-access modal", async () => {
    const fresh = { id: "cipher-1" } as Cipher;
    fetcher.fetch.mockResolvedValue(fresh);

    const verdict = await gate.check(partial, "user-1");

    expect(verdict).toEqual({ kind: "openWith", cipher: fresh });
    expect(fetcher.fetch).toHaveBeenCalledWith("cipher-1");
    expect(trigger.requestAccess).not.toHaveBeenCalled();
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
