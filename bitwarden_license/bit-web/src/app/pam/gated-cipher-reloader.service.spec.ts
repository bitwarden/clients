import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Observable, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { AccessLeaseResponse, CipherAccessState, PamApiService } from "@bitwarden/pam";

import { PamGatedCipherReloader } from "./gated-cipher-reloader.service";
import { LeasedCipherFetcherService } from "./services/leased-cipher-fetcher.service";

describe("PamGatedCipherReloader", () => {
  let pamApiService: MockProxy<PamApiService>;
  let fetcher: MockProxy<LeasedCipherFetcherService>;
  let state$: BehaviorSubject<CipherAccessState>;
  let reloader: PamGatedCipherReloader;

  // Let the `from(promise)` inside the stream settle before asserting.
  const tick = () => new Promise((resolve) => setTimeout(resolve));

  const leased = { id: "lease-1" } as AccessLeaseResponse;

  beforeEach(() => {
    state$ = new BehaviorSubject<CipherAccessState>({});
    pamApiService = mock<PamApiService>();
    pamApiService.getCipherAccessState$.mockReturnValue(state$);
    fetcher = mock<LeasedCipherFetcherService>();
    const accountService = mock<AccountService>();
    (accountService as unknown as { activeAccount$: Observable<unknown> }).activeAccount$ = of({
      id: "user-1",
    });

    TestBed.configureTestingModule({
      providers: [
        PamGatedCipherReloader,
        { provide: PamApiService, useValue: pamApiService },
        { provide: LeasedCipherFetcherService, useValue: fetcher },
        { provide: AccountService, useValue: accountService },
      ],
    });

    reloader = TestBed.inject(PamGatedCipherReloader);
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
