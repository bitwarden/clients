import { mock, MockProxy } from "jest-mock-extended";
import { NEVER, Subscription } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";

import { AccessEventService } from "../abstractions/access-event.service";
import type { CipherAccessStateView } from "../abstractions/access-lease";
import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";

import { DefaultAccessRefreshService } from "./default-access-refresh.service";
import { PamGatedCipherReloader } from "./pam-gated-cipher-reloader.service";

const CIPHER_ID = "cipher-1";

function stateWithLease(leaseId: string): CipherAccessStateView {
  return { cipherId: CIPHER_ID, activeLease: { id: leaseId } } as unknown as CipherAccessStateView;
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

  beforeEach(() => {
    requestsApi = mock<AccessRequestSdkService>();
    apiService = mock<ApiService>();
    logService = mock<LogService>();
    // No push in these tests: the reloader is exercised through local mutations only.
    const accessEvents: AccessEventService = { accessChanged$: () => NEVER };
    accessRefresh = new DefaultAccessRefreshService(accessEvents);
    reloader = new PamGatedCipherReloader(requestsApi, accessRefresh, apiService, logService);
  });

  afterEach(() => {
    subscription?.unsubscribe();
    subscription = undefined;
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
