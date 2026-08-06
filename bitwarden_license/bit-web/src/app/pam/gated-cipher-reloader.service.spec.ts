import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import type { CipherAccessStateView } from "@bitwarden/sdk-internal";

import { AccessRequestSdkService } from "./abstractions/access-request-sdk.service";
import { PamGatedCipherReloader } from "./gated-cipher-reloader.service";
import { LeasedCipherFetcherService } from "./services/leased-cipher-fetcher.service";

class FakeConfigService {
  private enabled = true;
  setEnabled(value: boolean) {
    this.enabled = value;
  }
  getFeatureFlag$ = () => new BehaviorSubject(this.enabled);
}

describe("PamGatedCipherReloader", () => {
  let accessRequestSdkService: {
    getCipherAccessState: jest.Mock<Promise<CipherAccessStateView>, [string]>;
  };
  let leasedCipherFetcher: { fetch: jest.Mock<Promise<Cipher | null>, [string]> };
  let configService: FakeConfigService;
  let reloader: PamGatedCipherReloader;

  beforeEach(() => {
    accessRequestSdkService = { getCipherAccessState: jest.fn() };
    leasedCipherFetcher = { fetch: jest.fn() };
    configService = new FakeConfigService();

    TestBed.configureTestingModule({
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: AccessRequestSdkService, useValue: accessRequestSdkService },
        { provide: LeasedCipherFetcherService, useValue: leasedCipherFetcher },
      ],
    });
    reloader = TestBed.inject(PamGatedCipherReloader);
  });

  it("emits null without polling access state when the PAM flag is off", async () => {
    configService.setEnabled(false);

    const result = await firstValueFrom(reloader.fullCipher$("cipher-1"));

    expect(result).toBeNull();
    expect(accessRequestSdkService.getCipherAccessState).not.toHaveBeenCalled();
  });

  it("emits null when the snapshot carries no active lease", async () => {
    accessRequestSdkService.getCipherAccessState.mockResolvedValue({
      activeLease: undefined,
    } as unknown as CipherAccessStateView);

    const result = await firstValueFrom(reloader.fullCipher$("cipher-1"));

    expect(result).toBeNull();
    expect(leasedCipherFetcher.fetch).not.toHaveBeenCalled();
  });

  it("fetches and emits the full cipher once an active lease appears", async () => {
    accessRequestSdkService.getCipherAccessState.mockResolvedValue({
      activeLease: { id: "lease-1" },
    } as unknown as CipherAccessStateView);
    const fullCipher = new Cipher();
    fullCipher.id = "cipher-1";
    leasedCipherFetcher.fetch.mockResolvedValue(fullCipher);

    const result = await firstValueFrom(reloader.fullCipher$("cipher-1"));

    expect(leasedCipherFetcher.fetch).toHaveBeenCalledWith("cipher-1");
    expect(result).toBe(fullCipher);
  });

  it("treats a transient access-state failure as no active lease rather than throwing", async () => {
    accessRequestSdkService.getCipherAccessState.mockRejectedValue(new Error("boom"));

    const result = await firstValueFrom(reloader.fullCipher$("cipher-1"));

    expect(result).toBeNull();
  });
});
