import { TestBed } from "@angular/core/testing";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { LeasedCipherFetcherService } from "@bitwarden/pam";

import { PamCipherOpenGate } from "./cipher-open-gate.service";

describe("PamCipherOpenGate", () => {
  let configService: jest.Mocked<Pick<ConfigService, "getFeatureFlag">>;
  let fetcher: jest.Mocked<Pick<LeasedCipherFetcherService, "fetch">>;
  let gate: PamCipherOpenGate;

  beforeEach(() => {
    configService = { getFeatureFlag: jest.fn().mockResolvedValue(true) };
    fetcher = { fetch: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        PamCipherOpenGate,
        { provide: ConfigService, useValue: configService },
        { provide: LeasedCipherFetcherService, useValue: fetcher },
      ],
    });

    gate = TestBed.inject(PamCipherOpenGate);
  });

  const partial = { id: "cipher-1", partialData: '{"Name":"n"}' };
  const notGated = { id: "cipher-1", partialData: undefined };

  it("short-circuits to 'open' when partialData is null (not gated / lease already covers it)", async () => {
    const verdict = await gate.check(notGated, "user-1");

    expect(verdict).toBe("open");
    expect(fetcher.fetch).not.toHaveBeenCalled();
  });

  it("short-circuits to 'open' when the PAM flag is off — no fetch", async () => {
    configService.getFeatureFlag.mockResolvedValue(false);

    const verdict = await gate.check(partial, "user-1");

    expect(verdict).toBe("open");
    expect(configService.getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.Pam);
    expect(fetcher.fetch).not.toHaveBeenCalled();
  });

  it("returns 'openWith' when the lease fetch succeeds — full data delivered", async () => {
    const fresh = { id: "cipher-1" } as Cipher;
    fetcher.fetch.mockResolvedValue(fresh);

    const verdict = await gate.check(partial, "user-1");

    expect(verdict).toEqual({ kind: "openWith", cipher: fresh });
    expect(fetcher.fetch).toHaveBeenCalledWith("cipher-1");
  });

  it("opens the partial view when there's no active lease — the cipher-lease banner drives the request inline", async () => {
    // No modal, no pre-fetch state read: the gate opens the partial cipher and the
    // injected banner owns every request interaction (request / cancel / start) and,
    // for the automatic path, the reloader reveals the full cipher in place.
    fetcher.fetch.mockResolvedValue(null);

    const verdict = await gate.check(partial, "user-1");

    expect(verdict).toBe("open");
    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
  });
});
