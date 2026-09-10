import { defer, Observable, tap } from "rxjs";

import { LogService } from "@bitwarden/logging";

/** Team owning the report flow. Groups the flow's track in the DevTools performance panel. */
const TRACK_GROUP = "DIRT";

/**
 * Every step of the report flow shares one track so load, generate and save read as a single
 * timeline rather than one lane per service.
 */
const TRACK = "AccessReportFlow";

/**
 * Times a self-contained async step and records it against the report flow track.
 *
 * The timer starts when the returned observable is subscribed to and stops on the first emission,
 * so this measures the whole chain above it. Use it on a standalone leg, such as a `from(promise)`
 * or the last operator of a pipe. For consecutive steps within one pipe use {@link flowTimer},
 * which measures each step rather than the running total.
 *
 * Nothing is recorded if the source errors. Each subscription is timed separately.
 *
 * @example Wrapping a promise, with counts read from the emitted value.
 * ```ts
 * from(this.someService.fetchItems(id)).pipe(
 *   measureFlowStep(this.logService, "Stage: items fetched", (items) => [
 *     ["itemCount", items.length],
 *   ]),
 * );
 * ```
 *
 * @example Without properties.
 * ```ts
 * this.someApiService.getThing$(id).pipe(
 *   measureFlowStep(this.logService, "Stage: thing fetched"),
 * );
 * ```
 */
export function measureFlowStep<T>(
  logService: LogService,
  name: string,
  properties?: (value: T) => [string, any][],
): (source: Observable<T>) => Observable<T> {
  return (source: Observable<T>) =>
    defer(() => {
      const start = performance.now();

      return source.pipe(
        tap((value) => logService.measure(start, TRACK_GROUP, TRACK, name, properties?.(value))),
      );
    });
}

/**
 * Creates a stopwatch for consecutive steps, each measured from the end of the previous one.
 *
 * The first step is measured from the moment the stopwatch is created, so create it immediately
 * before the first step. Prefer this over chaining {@link measureFlowStep} twice in one pipe:
 * that operator starts its timer at subscribe, so a second one would report the running total
 * rather than its own step.
 *
 * Works for synchronous statements and inside pipe callbacks alike.
 *
 * @example Consecutive synchronous steps.
 * ```ts
 * const measureStep = flowTimer(this.logService);
 *
 * const grouped = this.groupItems(items);
 * measureStep("Stage: items grouped", [["itemCount", items.length]]);
 *
 * this.applyDefaults(grouped);
 * measureStep("Stage: defaults applied");
 * ```
 *
 * @example Consecutive steps across one pipe.
 * ```ts
 * const measureStep = flowTimer(this.logService);
 *
 * return source$.pipe(
 *   tap((bytes) => measureStep("Stage: bytes received", [["byteSize", bytes.byteLength]])),
 *   switchMap((bytes) => this.transform$(bytes)),
 *   map((result) => {
 *     measureStep("Stage: bytes transformed");
 *     return result;
 *   }),
 * );
 * ```
 */
export function flowTimer(
  logService: LogService,
): (name: string, properties?: [string, any][]) => void {
  let last = performance.now();

  return (name: string, properties?: [string, any][]) => {
    logService.measure(last, TRACK_GROUP, TRACK, name, properties);
    last = performance.now();
  };
}
