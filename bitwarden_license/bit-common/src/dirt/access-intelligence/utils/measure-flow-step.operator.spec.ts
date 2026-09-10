import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of, Subject, throwError } from "rxjs";

import { LogService } from "@bitwarden/logging";

import { flowTimer, measureFlowStep } from "./measure-flow-step.operator";

describe("measure-flow-step", () => {
  let logService: MockProxy<LogService>;
  let now: jest.SpyInstance<number, []>;

  /** Drives `performance.now()` through a fixed sequence so measured windows are exact. */
  const givenClock = (...ticks: number[]) => {
    ticks.forEach((tick) => now.mockReturnValueOnce(tick));
  };

  /** The `start` timestamp each measure call was given, in call order. */
  const measuredStarts = () => logService.measure.mock.calls.map((call) => call[0]);

  beforeEach(() => {
    logService = mock<LogService>();
    now = jest.spyOn(performance, "now").mockReturnValue(0);
  });

  afterEach(() => {
    now.mockRestore();
  });

  describe("measureFlowStep", () => {
    it("records the step against the shared report flow track", async () => {
      await firstValueFrom(of("value").pipe(measureFlowStep(logService, "Load: something")));

      expect(logService.measure).toHaveBeenCalledWith(
        expect.any(Number),
        "DIRT",
        "AccessReportFlow",
        "Load: something",
        undefined,
      );
    });

    it("passes properties built from the emitted value", async () => {
      await firstValueFrom(
        of([1, 2, 3]).pipe(
          measureFlowStep(logService, "Load: items", (items) => [["itemCount", items.length]]),
        ),
      );

      expect(logService.measure).toHaveBeenCalledWith(
        expect.any(Number),
        "DIRT",
        "AccessReportFlow",
        "Load: items",
        [["itemCount", 3]],
      );
    });

    it("emits the source value unchanged", async () => {
      const value = await firstValueFrom(
        of("untouched").pipe(measureFlowStep(logService, "Load: something")),
      );

      expect(value).toBe("untouched");
    });

    it("starts the timer at subscribe rather than at construction", async () => {
      givenClock(100, 500);

      // Constructing the observable must not read the clock; only subscribing may.
      const measured$ = of("value").pipe(measureFlowStep(logService, "Load: something"));
      expect(now).not.toHaveBeenCalled();

      await firstValueFrom(measured$);

      expect(measuredStarts()).toEqual([100]);
    });

    it("times each subscription separately", async () => {
      givenClock(100, 800);
      const measured$ = of("value").pipe(measureFlowStep(logService, "Load: something"));

      await firstValueFrom(measured$);
      await firstValueFrom(measured$);

      expect(measuredStarts()).toEqual([100, 800]);
    });

    it("records nothing when the source errors", async () => {
      const failing$ = throwError(() => new Error("boom")).pipe(
        measureFlowStep(logService, "Load: something"),
      );

      await expect(firstValueFrom(failing$)).rejects.toThrow("boom");
      expect(logService.measure).not.toHaveBeenCalled();
    });

    it("records once per emission for a multi-emission source", async () => {
      const source = new Subject<string>();
      const subscription = source.pipe(measureFlowStep(logService, "Load: something")).subscribe();

      source.next("first");
      source.next("second");
      subscription.unsubscribe();

      expect(logService.measure).toHaveBeenCalledTimes(2);
    });
  });

  describe("flowTimer", () => {
    it("measures the first step from the moment the timer is created", () => {
      givenClock(100, 250);

      const measureStep = flowTimer(logService);
      measureStep("Generate: first");

      expect(measuredStarts()).toEqual([100]);
    });

    // Guards the reason flowTimer exists: chained measureFlowStep operators would each report the
    // running total from subscribe, which would double-count every step after the first.
    it("measures each step from the end of the previous one, not cumulatively", () => {
      givenClock(100, 250, 400);

      const measureStep = flowTimer(logService);
      measureStep("Generate: first");
      measureStep("Generate: second");
      measureStep("Generate: third");

      expect(measuredStarts()).toEqual([100, 250, 400]);
    });

    it("records against the shared report flow track and forwards properties", () => {
      const measureStep = flowTimer(logService);
      measureStep("Generate: applications grouped", [["applicationCount", 7]]);

      expect(logService.measure).toHaveBeenCalledWith(
        expect.any(Number),
        "DIRT",
        "AccessReportFlow",
        "Generate: applications grouped",
        [["applicationCount", 7]],
      );
    });

    it("gives each timer its own independent sequence", () => {
      givenClock(100, 200, 300, 400);

      const first = flowTimer(logService);
      const second = flowTimer(logService);
      first("Generate: from first timer");
      second("Generate: from second timer");

      expect(measuredStarts()).toEqual([100, 200]);
    });
  });
});
