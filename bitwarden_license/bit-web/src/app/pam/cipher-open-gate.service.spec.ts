import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";

import { PamCipherOpenGate } from "./cipher-open-gate.service";
import { LeasedCipherFetcherService } from "./services/leased-cipher-fetcher.service";

describe("PamCipherOpenGate", () => {
  let configService: ReturnType<typeof mock<ConfigService>>;
  let leasedCipherFetcher: ReturnType<typeof mock<LeasedCipherFetcherService>>;
  let gate: PamCipherOpenGate;

  beforeEach(() => {
    configService = mock<ConfigService>();
    leasedCipherFetcher = mock<LeasedCipherFetcherService>();

    TestBed.configureTestingModule({
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: LeasedCipherFetcherService, useValue: leasedCipherFetcher },
      ],
    });
    gate = TestBed.inject(PamCipherOpenGate);
  });

  it("opens straight away when the cipher carries no partialData", async () => {
    const result = await gate.check({ id: "cipher-1", partialData: undefined }, "user-1");

    expect(result).toBe("open");
    expect(configService.getFeatureFlag).not.toHaveBeenCalled();
  });

  it("opens the partial copy when the PAM flag is off, even if partialData is present", async () => {
    configService.getFeatureFlag.mockResolvedValue(false);

    const result = await gate.check({ id: "cipher-1", partialData: "{}" }, "user-1");

    expect(result).toBe("open");
    expect(leasedCipherFetcher.fetch).not.toHaveBeenCalled();
  });

  it("opens with the fetched full cipher when an active lease already covers it", async () => {
    configService.getFeatureFlag.mockResolvedValue(true);
    const fullCipher = new Cipher();
    fullCipher.id = "cipher-1";
    leasedCipherFetcher.fetch.mockResolvedValue(fullCipher);

    const result = await gate.check({ id: "cipher-1", partialData: "{}" }, "user-1");

    expect(leasedCipherFetcher.fetch).toHaveBeenCalledWith("cipher-1");
    expect(result).toEqual({ kind: "openWith", cipher: fullCipher });
  });

  it("opens the partial copy when gated with no active lease", async () => {
    configService.getFeatureFlag.mockResolvedValue(true);
    leasedCipherFetcher.fetch.mockResolvedValue(null);

    const result = await gate.check({ id: "cipher-1", partialData: "{}" }, "user-1");

    expect(result).toBe("open");
  });
});
