import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { NEVER, Subscription } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";

import { AccessEventService } from "../abstractions/access-event.service";
import type { CipherAccessStateView } from "../abstractions/access-lease";
import { AccessRefreshService } from "../abstractions/access-refresh.service";
import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";
import { drainMicrotasks } from "../testing/drain-microtasks";

import { CipherAccessStateService } from "./cipher-access-state.service";
import { DefaultAccessRefreshService } from "./default-access-refresh.service";
import { PamGatedCipherReloader } from "./pam-gated-cipher-reloader.service";

const CIPHER_ID = "cipher-1";

/**
 * `notAfter` is not optional decoration: the reloader treats a lease as access only while its
 * window is still open, so a fixture without one describes a lease that has already lapsed.
 */
function stateWithLease(leaseId: string, notAfterMs = Date.now() + 30 * 60 * 1000) {
  return {
    cipherId: CIPHER_ID,
    activeLease: { id: leaseId, notAfter: new Date(notAfterMs).toISOString() },
  } as unknown as CipherAccessStateView;
}

function stateWithoutLease(): CipherAccessStateView {
  return { cipherId: CIPHER_ID, activeLease: undefined } as unknown as CipherAccessStateView;
}

/** A server cipher response, `partialData` set when the server is still restricting it. */
function cipherResponse(partialData?: string): CipherResponse {
  return {
    id: CIPHER_ID,
    type: 1,
    name: "2.abc|def|ghi",
    revisionDate: "2026-08-17T09:00:00.000Z",
    creationDate: "2026-08-01T09:00:00.000Z",
    collectionIds: [],
    partialData,
  } as unknown as CipherResponse;
}

describe("PamGatedCipherReloader", () => {
  let requestsApi: MockProxy<AccessRequestSdkService>;
  let apiService: MockProxy<ApiService>;
  let logService: MockProxy<LogService>;
  let accessRefresh: DefaultAccessRefreshService;
  let reloader: PamGatedCipherReloader;
  let subscription: Subscription | undefined;

  /** Collects everything `fullCipher$` emits for the cipher under test. */
  function collect(): Array<Cipher | null> {
    const emissions: Array<Cipher | null> = [];
    subscription = reloader.fullCipher$(CIPHER_ID).subscribe((c) => emissions.push(c));
    return emissions;
  }

  /** Lets the promise chain inside the pipeline settle. */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  /**
   * The same, under fake timers: `setTimeout` no longer runs on its own. The expiry cases need a
   * fake clock — a real one would mean waiting out a lease.
   */
  const settleFake = drainMicrotasks;

  beforeEach(() => {
    requestsApi = mock<AccessRequestSdkService>();
    apiService = mock<ApiService>();
    logService = mock<LogService>();
    // No push in these tests: the reloader is exercised through local mutations only.
    const accessEvents: AccessEventService = {
      accessChanged$: () => NEVER,
      approverInboxChanged$: () => NEVER,
    };
    accessRefresh = new DefaultAccessRefreshService(accessEvents);
    // The real state stream, not a stub: the expiry cases below are exactly the seam between the
    // two, so a stubbed one would test nothing.
    TestBed.configureTestingModule({
      providers: [
        { provide: AccessRequestSdkService, useValue: requestsApi },
        { provide: AccessRefreshService, useValue: accessRefresh },
        { provide: LogService, useValue: logService },
        CipherAccessStateService,
      ],
    });
    reloader = new PamGatedCipherReloader(
      TestBed.inject(CipherAccessStateService),
      apiService,
      logService,
    );
  });

  afterEach(() => {
    subscription?.unsubscribe();
    subscription = undefined;
    jest.useRealTimers();
  });

  it("emits null while no lease covers the cipher, and fetches nothing", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue(stateWithoutLease());

    const emissions = collect();
    await settle();

    expect(emissions).toEqual([null]);
    expect(apiService.getFullCipherDetails).not.toHaveBeenCalled();
  });

  it("fetches the full cipher through the standard cipher read once a lease exists", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue(stateWithLease("lease-1"));
    apiService.getFullCipherDetails.mockResolvedValue(cipherResponse());

    const emissions = collect();
    await settle();

    expect(apiService.getFullCipherDetails).toHaveBeenCalledWith(CIPHER_ID);
    expect(emissions).toHaveLength(1);
    expect(emissions[0]).toBeInstanceOf(Cipher);
    expect(emissions[0]?.partialData).toBeUndefined();
  });

  it("never writes the fetched cipher into the local cache", async () => {
    // The cache must stay partial so a lapsed lease cannot leave decryptable secrets in local state.
    requestsApi.getCipherAccessState.mockResolvedValue(stateWithLease("lease-1"));
    apiService.getFullCipherDetails.mockResolvedValue(cipherResponse());

    collect();
    await settle();

    expect(apiService.putCipher).not.toHaveBeenCalled();
    expect(apiService.postCipher).not.toHaveBeenCalled();
  });

  it("stays gated when the server still restricts the cipher", async () => {
    // The lease lapsed between the state read and the fetch.
    requestsApi.getCipherAccessState.mockResolvedValue(stateWithLease("lease-1"));
    apiService.getFullCipherDetails.mockResolvedValue(cipherResponse('{"name":"gated"}'));

    const emissions = collect();
    await settle();

    expect(emissions).toEqual([null]);
  });

  it("re-reads on an access change and reveals the cipher", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue(stateWithoutLease());
    apiService.getFullCipherDetails.mockResolvedValue(cipherResponse());

    const emissions = collect();
    await settle();
    expect(emissions).toEqual([null]);

    requestsApi.getCipherAccessState.mockResolvedValue(stateWithLease("lease-1"));
    accessRefresh.notifyAccessChanged(CIPHER_ID);
    await settle();

    expect(emissions).toHaveLength(2);
    expect(emissions[1]).toBeInstanceOf(Cipher);
  });

  it("re-locks when the lease goes away", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue(stateWithLease("lease-1"));
    apiService.getFullCipherDetails.mockResolvedValue(cipherResponse());

    const emissions = collect();
    await settle();

    requestsApi.getCipherAccessState.mockResolvedValue(stateWithoutLease());
    accessRefresh.notifyAccessChanged(CIPHER_ID);
    await settle();

    expect(emissions).toHaveLength(2);
    expect(emissions[1]).toBeNull();
  });

  it("re-locks when the lease's window closes with nothing else happening", async () => {
    // PM-41837: a lease running out is announced by nobody — no mutation here, no server push —
    // so the open item has to notice the moment passing on its own.
    jest.useFakeTimers();
    requestsApi.getCipherAccessState.mockResolvedValue(
      stateWithLease("lease-1", Date.now() + 150_000),
    );
    apiService.getFullCipherDetails.mockResolvedValue(cipherResponse());

    const emissions = collect();
    await settleFake();
    expect(emissions[0]).toBeInstanceOf(Cipher);

    // The state read is unchanged: the server has not been asked again, and would still say the
    // lease is there if it were.
    jest.advanceTimersByTime(150_000);
    await settleFake();

    expect(emissions).toHaveLength(2);
    expect(emissions[1]).toBeNull();
  });

  it("stays revealed while the lease's window is still open", async () => {
    jest.useFakeTimers();
    requestsApi.getCipherAccessState.mockResolvedValue(
      stateWithLease("lease-1", Date.now() + 150_000),
    );
    apiService.getFullCipherDetails.mockResolvedValue(cipherResponse());

    const emissions = collect();
    await settleFake();

    jest.advanceTimersByTime(149_000);
    await settleFake();

    expect(emissions).toHaveLength(1);
  });

  it("re-reads once the lease lapses, and does not loop on the answer", async () => {
    jest.useFakeTimers();
    requestsApi.getCipherAccessState.mockResolvedValue(
      stateWithLease("lease-1", Date.now() + 60_000),
    );
    apiService.getFullCipherDetails.mockResolvedValue(cipherResponse());

    collect();
    await settleFake();
    expect(requestsApi.getCipherAccessState).toHaveBeenCalledTimes(1);

    // The re-read answers with the lease still on it — a server whose clock trails this one. The
    // item stays locked, and a second timer must NOT be armed against a moment already past.
    jest.advanceTimersByTime(60_000);
    await settleFake();
    expect(requestsApi.getCipherAccessState).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(600_000);
    await settleFake();

    expect(requestsApi.getCipherAccessState).toHaveBeenCalledTimes(2);
  });

  it("does not re-fetch when an unrelated change leaves the same lease in place", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue(stateWithLease("lease-1"));
    apiService.getFullCipherDetails.mockResolvedValue(cipherResponse());

    collect();
    await settle();
    expect(apiService.getFullCipherDetails).toHaveBeenCalledTimes(1);

    // Same lease id — e.g. a sibling request resolved. Nothing about this cipher's payload changed.
    accessRefresh.notifyAccessChanged(CIPHER_ID);
    await settle();

    expect(apiService.getFullCipherDetails).toHaveBeenCalledTimes(1);
  });

  it("re-fetches when a different lease replaces the first", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue(stateWithLease("lease-1"));
    apiService.getFullCipherDetails.mockResolvedValue(cipherResponse());

    collect();
    await settle();

    requestsApi.getCipherAccessState.mockResolvedValue(stateWithLease("lease-2"));
    accessRefresh.notifyAccessChanged(CIPHER_ID);
    await settle();

    expect(apiService.getFullCipherDetails).toHaveBeenCalledTimes(2);
  });

  it("ignores a change notified for a different cipher", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue(stateWithoutLease());

    collect();
    await settle();
    requestsApi.getCipherAccessState.mockClear();

    accessRefresh.notifyAccessChanged("some-other-cipher");
    await settle();

    expect(requestsApi.getCipherAccessState).not.toHaveBeenCalled();
  });

  it("stays gated and logs when the access-state read fails", async () => {
    requestsApi.getCipherAccessState.mockRejectedValue(new Error("boom"));

    const emissions = collect();
    await settle();

    expect(emissions).toEqual([null]);
    expect(logService.error).toHaveBeenCalled();
  });

  it("stays gated and logs when the cipher fetch fails", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue(stateWithLease("lease-1"));
    apiService.getFullCipherDetails.mockRejectedValue(new Error("boom"));

    const emissions = collect();
    await settle();

    expect(emissions).toEqual([null]);
    expect(logService.error).toHaveBeenCalled();
  });
});
