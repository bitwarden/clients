import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { NEVER, Subscription } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { AccessEventService } from "../abstractions/access-event.service";
import type { CipherAccessStateView } from "../abstractions/access-lease";
import { AccessRefreshService } from "../abstractions/access-refresh.service";
import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";
import { drainMicrotasks } from "../testing/drain-microtasks";

import { CipherAccessStateService } from "./cipher-access-state.service";
import { DefaultAccessRefreshService } from "./default-access-refresh.service";

const CIPHER_ID = "cipher-1";

function stateWithLease(notAfterMs: number): CipherAccessStateView {
  return {
    cipherId: CIPHER_ID,
    activeLease: { id: "lease-1", notAfter: new Date(notAfterMs).toISOString() },
  } as unknown as CipherAccessStateView;
}

function restingState(): CipherAccessStateView {
  return { cipherId: CIPHER_ID, badgeState: "privileged" } as unknown as CipherAccessStateView;
}

describe("CipherAccessStateService", () => {
  let requestsApi: MockProxy<AccessRequestSdkService>;
  let logService: MockProxy<LogService>;
  let accessRefresh: DefaultAccessRefreshService;
  let service: CipherAccessStateService;
  let subscription: Subscription | undefined;

  /** Collects everything the stream emits for the cipher under test. */
  function collect(): Array<CipherAccessStateView | null> {
    const emissions: Array<CipherAccessStateView | null> = [];
    subscription = service.state$(CIPHER_ID).subscribe((state) => emissions.push(state));
    return emissions;
  }

  /** The reads are promises and the clock here is a fake one, so nothing settles on its own. */
  const settle = drainMicrotasks;

  beforeEach(() => {
    jest.useFakeTimers();
    requestsApi = mock<AccessRequestSdkService>();
    logService = mock<LogService>();
    const accessEvents: AccessEventService = {
      accessChanged$: () => NEVER,
      approverInboxChanged$: () => NEVER,
    };
    accessRefresh = new DefaultAccessRefreshService(accessEvents);
    TestBed.configureTestingModule({
      providers: [
        { provide: AccessRequestSdkService, useValue: requestsApi },
        { provide: AccessRefreshService, useValue: accessRefresh },
        { provide: LogService, useValue: logService },
        CipherAccessStateService,
      ],
    });
    service = TestBed.inject(CipherAccessStateService);
  });

  afterEach(() => {
    subscription?.unsubscribe();
    subscription = undefined;
    jest.useRealTimers();
  });

  it("reads the state once on subscribe", async () => {
    const state = restingState();
    requestsApi.getCipherAccessState.mockResolvedValue(state);

    const emissions = collect();
    await settle();

    expect(emissions).toEqual([state]);
    expect(requestsApi.getCipherAccessState).toHaveBeenCalledWith(CIPHER_ID);
  });

  it("re-reads when this cipher's access changes", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue(restingState());

    const emissions = collect();
    await settle();

    accessRefresh.notifyAccessChanged(CIPHER_ID);
    await settle();

    expect(emissions).toHaveLength(2);
    expect(requestsApi.getCipherAccessState).toHaveBeenCalledTimes(2);
  });

  it("re-emits the state it holds the moment the lease's window closes", async () => {
    // The value that lands is the one already read — nothing waits on a round trip, so a consumer
    // clamping against the clock can re-lock on the spot.
    const state = stateWithLease(Date.now() + 150_000);
    requestsApi.getCipherAccessState.mockResolvedValue(state);

    const emissions = collect();
    await settle();
    expect(emissions).toEqual([state]);

    jest.advanceTimersByTime(150_000);

    expect(emissions).toEqual([state, state]);
  });

  it("re-reads after the lease's window closes, so the badge stops saying active", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue(stateWithLease(Date.now() + 150_000));

    const emissions = collect();
    await settle();

    const resting = restingState();
    requestsApi.getCipherAccessState.mockResolvedValue(resting);
    jest.advanceTimersByTime(150_000);
    await settle();

    expect(requestsApi.getCipherAccessState).toHaveBeenCalledTimes(2);
    expect(emissions[emissions.length - 1]).toBe(resting);
  });

  it("holds still until the lease's window actually closes", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue(stateWithLease(Date.now() + 150_000));

    const emissions = collect();
    await settle();

    jest.advanceTimersByTime(149_000);
    await settle();

    expect(emissions).toHaveLength(1);
    expect(requestsApi.getCipherAccessState).toHaveBeenCalledTimes(1);
  });

  it("arms nothing for a lease already past its window", async () => {
    // Otherwise the timer fires at once, re-reads, gets the same answer, and arms itself again.
    requestsApi.getCipherAccessState.mockResolvedValue(stateWithLease(Date.now() - 1_000));

    const emissions = collect();
    await settle();

    jest.advanceTimersByTime(600_000);
    await settle();

    expect(emissions).toHaveLength(1);
    expect(requestsApi.getCipherAccessState).toHaveBeenCalledTimes(1);
  });

  it("arms nothing for a lease whose expiry will not parse", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue({
      cipherId: CIPHER_ID,
      activeLease: { id: "lease-1", notAfter: "not a date" },
    } as unknown as CipherAccessStateView);

    const emissions = collect();
    await settle();

    jest.advanceTimersByTime(600_000);
    await settle();

    expect(emissions).toHaveLength(1);
    expect(requestsApi.getCipherAccessState).toHaveBeenCalledTimes(1);
  });

  it("emits null and logs when the read fails, and still re-reads on the next change", async () => {
    requestsApi.getCipherAccessState.mockRejectedValue(new Error("boom"));

    const emissions = collect();
    await settle();

    expect(emissions).toEqual([null]);
    expect(logService.error).toHaveBeenCalled();

    const state = restingState();
    requestsApi.getCipherAccessState.mockResolvedValue(state);
    accessRefresh.notifyAccessChanged(CIPHER_ID);
    await settle();

    expect(emissions).toEqual([null, state]);
  });

  it("ignores a change announced for another cipher", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue(restingState());

    collect();
    await settle();

    accessRefresh.notifyAccessChanged("some-other-cipher");
    await settle();

    expect(requestsApi.getCipherAccessState).toHaveBeenCalledTimes(1);
  });
});
