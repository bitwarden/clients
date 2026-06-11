import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import {
  AccessLeaseResponse,
  CipherAccessState,
  LeasedCipherFetcher,
  PamApiService,
} from "@bitwarden/pam";

import { PamGatedCipherReloader } from "./gated-cipher-reloader.service";

describe("PamGatedCipherReloader", () => {
  let pamApiService: jest.Mocked<Pick<PamApiService, "getCipherAccessState$">>;
  let fetcher: jest.Mocked<Pick<LeasedCipherFetcher, "fetch">>;
  let state$: BehaviorSubject<CipherAccessState>;
  let reloader: PamGatedCipherReloader;

  // Let the `from(promise)` inside the stream settle before asserting.
  const tick = () => new Promise((resolve) => setTimeout(resolve));

  const leased = { id: "lease-1" } as AccessLeaseResponse;

  beforeEach(() => {
    state$ = new BehaviorSubject<CipherAccessState>({});
    pamApiService = { getCipherAccessState$: jest.fn().mockReturnValue(state$) };
    fetcher = { fetch: jest.fn() };
    const accountService = { activeAccount$: of({ id: "user-1" }) } as unknown as AccountService;
    reloader = new PamGatedCipherReloader(
      pamApiService as unknown as PamApiService,
      fetcher as unknown as LeasedCipherFetcher,
      accountService,
    );
  });

  it("emits null and never fetches while no active lease covers the cipher", async () => {
    const emissions: (Cipher | null)[] = [];
    const sub = reloader.fullCipher$("cipher-1").subscribe((c) => emissions.push(c));
    await tick();

    expect(emissions).toEqual([null]);
    expect(fetcher.fetch).not.toHaveBeenCalled();
    expect(pamApiService.getCipherAccessState$).toHaveBeenCalledWith("cipher-1", "user-1");
    sub.unsubscribe();
  });

  it("fetches and emits the full cipher once a lease becomes active", async () => {
    const full = { id: "cipher-1" } as Cipher;
    fetcher.fetch.mockResolvedValue(full);
    const emissions: (Cipher | null)[] = [];
    const sub = reloader.fullCipher$("cipher-1").subscribe((c) => emissions.push(c));

    state$.next({ activeLease: leased });
    await tick();

    expect(fetcher.fetch).toHaveBeenCalledWith("cipher-1");
    expect(emissions).toEqual([null, full]);
    sub.unsubscribe();
  });

  it("does not re-fetch when the access state re-emits the same active lease", async () => {
    fetcher.fetch.mockResolvedValue({ id: "cipher-1" } as Cipher);
    const sub = reloader.fullCipher$("cipher-1").subscribe();

    state$.next({ activeLease: leased });
    await tick();
    // A later snapshot for the same lease (e.g. an unrelated field changed) must not re-fetch.
    state$.next({ activeLease: leased, pendingRequest: undefined });
    await tick();

    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
    sub.unsubscribe();
  });

  it("stays on the partial view (emits null) when the leased fetch comes back empty", async () => {
    fetcher.fetch.mockResolvedValue(null);
    const emissions: (Cipher | null)[] = [];
    const sub = reloader.fullCipher$("cipher-1").subscribe((c) => emissions.push(c));

    state$.next({ activeLease: leased });
    await tick();

    expect(emissions).toEqual([null, null]);
    sub.unsubscribe();
  });
});
