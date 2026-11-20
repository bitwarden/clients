import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { Subject, Subscription } from "rxjs";

import {
  AccessRefreshService,
  AccessRequestSdkService,
  type AccessPreCheckView,
} from "@bitwarden/bit-pam";

import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";

import { StartBlock, StartSlotService } from "./start-slot.service";

const NOW = Date.UTC(2026, 10, 20, 12, 0);
const HOUR_MS = 3_600_000;

function preCheck(overrides: Partial<AccessPreCheckView> = {}): AccessPreCheckView {
  return { canStartLease: true, ...overrides } as unknown as AccessPreCheckView;
}

describe("StartSlotService", () => {
  let service: StartSlotService;
  let requestsApi: MockProxy<AccessRequestSdkService>;
  let accessChanged$: Subject<void>;
  let ticks$: Subject<number>;
  let emitted: (StartBlock | null)[];
  let subscription: Subscription;

  /** Lets the pre-check promise settle and its emission land. */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  async function watch(): Promise<void> {
    subscription = service.blockedUntil$("cipher-1").subscribe((block) => emitted.push(block));
    await settle();
  }

  async function tick(nowMs: number): Promise<void> {
    ticks$.next(nowMs);
    await settle();
  }

  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(NOW);
    requestsApi = mock<AccessRequestSdkService>();
    accessChanged$ = new Subject<void>();
    ticks$ = new Subject<number>();
    emitted = [];

    TestBed.configureTestingModule({
      providers: [
        { provide: AccessRequestSdkService, useValue: requestsApi },
        { provide: AccessRefreshService, useValue: { accessChanged$: () => accessChanged$ } },
        { provide: AccessBadgeTickerService, useValue: { ticks$ } },
      ],
    });
    service = TestBed.inject(StartSlotService);
  });

  afterEach(() => {
    subscription?.unsubscribe();
    jest.restoreAllMocks();
  });

  it("is null while the slot is free, and stops re-reading", async () => {
    requestsApi.preCheck.mockResolvedValue(preCheck());

    await watch();
    await tick(NOW + 2 * HOUR_MS);

    expect(emitted).toEqual([null]);
    expect(requestsApi.preCheck).toHaveBeenCalledTimes(1);
  });

  it("reports when the slot frees, and re-reads once it should have", async () => {
    const freesAt = new Date(NOW + 30_000).toISOString();
    requestsApi.preCheck.mockResolvedValueOnce(
      preCheck({ canStartLease: false, slotFreesAt: freesAt }),
    );
    requestsApi.preCheck.mockResolvedValueOnce(preCheck());

    await watch();
    await tick(NOW + 29_000);
    expect(requestsApi.preCheck).toHaveBeenCalledTimes(1);

    await tick(NOW + 30_000);
    expect(emitted).toEqual([{ freesAt }, null]);
  });

  it("re-reads every minute while the slot frees later, catching an early end", async () => {
    requestsApi.preCheck.mockResolvedValue(
      preCheck({ canStartLease: false, slotFreesAt: new Date(NOW + 2 * HOUR_MS).toISOString() }),
    );

    await watch();
    await tick(NOW + 59_000);
    expect(requestsApi.preCheck).toHaveBeenCalledTimes(1);

    await tick(NOW + 60_000);
    expect(requestsApi.preCheck).toHaveBeenCalledTimes(2);
  });

  it("stays blocked without a free time, rather than reading the slot as free", async () => {
    requestsApi.preCheck.mockResolvedValue(preCheck({ canStartLease: false }));

    await watch();

    expect(emitted).toEqual([{ freesAt: null }]);
  });

  it.each([
    ["has already passed", new Date(NOW - HOUR_MS).toISOString()],
    ["cannot be read", "not a date"],
    ["is not given", undefined],
  ])("waits the interval, not every tick, when the free time %s", async (_case, slotFreesAt) => {
    requestsApi.preCheck.mockResolvedValue(preCheck({ canStartLease: false, slotFreesAt }));

    await watch();
    for (let s = 1; s < 60; s++) {
      await tick(NOW + s * 1000);
    }
    expect(requestsApi.preCheck).toHaveBeenCalledTimes(1);

    await tick(NOW + 60_000);
    expect(requestsApi.preCheck).toHaveBeenCalledTimes(2);
  });

  it("fails open when the pre-check cannot be read", async () => {
    requestsApi.preCheck.mockRejectedValue(new Error("offline"));

    await watch();

    expect(emitted).toEqual([null]);
  });

  it("re-reads on an access change", async () => {
    requestsApi.preCheck.mockResolvedValueOnce(preCheck());
    requestsApi.preCheck.mockResolvedValueOnce(
      preCheck({ canStartLease: false, slotFreesAt: new Date(NOW + HOUR_MS).toISOString() }),
    );

    await watch();
    accessChanged$.next();
    await settle();

    expect(emitted).toEqual([null, { freesAt: new Date(NOW + HOUR_MS).toISOString() }]);
  });
});
