import { NgZone } from "@angular/core";

import { ACTIVE_JOB_MAX_READS, ActiveJobPoller, activeJobPollDelay } from "./active-job-poller";

describe("activeJobPollDelay", () => {
  it("starts at 10 seconds and doubles up to a 2 minute ceiling", () => {
    expect([0, 1, 2, 3, 4, 5].map(activeJobPollDelay)).toEqual([
      10_000, 20_000, 40_000, 80_000, 120_000, 120_000,
    ]);
  });
});

describe("ActiveJobPoller", () => {
  let outsideAngular: jest.Mock;
  let read: jest.Mock<Promise<boolean>, []>;
  let poller: ActiveJobPoller;

  beforeEach(() => {
    jest.useFakeTimers();
    outsideAngular = jest.fn((fn: () => unknown) => fn());
    read = jest.fn().mockResolvedValue(true);
    poller = new ActiveJobPoller({ runOutsideAngular: outsideAngular } as unknown as NgZone, read);
  });

  afterEach(() => {
    poller.stop();
    jest.useRealTimers();
  });

  it("waits longer before each read", async () => {
    poller.start();

    await jest.advanceTimersByTimeAsync(9_999);
    expect(read).toHaveBeenCalledTimes(0);
    await jest.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(19_999);
    expect(read).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("schedules its timer outside the Angular zone", () => {
    poller.start();
    expect(outsideAngular).toHaveBeenCalledTimes(1);
  });

  it("ends the run once the read reports no running job", async () => {
    read.mockResolvedValueOnce(true).mockResolvedValue(false);
    poller.start();

    await jest.advanceTimersByTimeAsync(60 * 60_000);

    expect(read).toHaveBeenCalledTimes(2);
  });

  it("gives up after a bounded number of reads", async () => {
    poller.start();

    await jest.advanceTimersByTimeAsync(60 * 60_000);

    expect(read).toHaveBeenCalledTimes(ACTIVE_JOB_MAX_READS);
  });

  it("ends the run on the first failed read", async () => {
    read.mockRejectedValueOnce(new Error("boom"));
    poller.start();

    await jest.advanceTimersByTimeAsync(60 * 60_000);

    expect(read).toHaveBeenCalledTimes(1);
  });

  it("starts a fresh run, back at the shortest wait, on start", async () => {
    poller.start();
    await jest.advanceTimersByTimeAsync(10_000 + 20_000);
    expect(read).toHaveBeenCalledTimes(2);

    poller.start();
    await jest.advanceTimersByTimeAsync(10_000);

    expect(read).toHaveBeenCalledTimes(3);
  });

  it("ignores a read that lands after stop", async () => {
    let resolveRead!: (running: boolean) => void;
    read.mockReturnValueOnce(new Promise((resolve) => (resolveRead = resolve)));
    poller.start();
    await jest.advanceTimersByTimeAsync(10_000);

    poller.stop();
    resolveRead(true);
    await jest.advanceTimersByTimeAsync(60 * 60_000);

    expect(read).toHaveBeenCalledTimes(1);
  });
});
