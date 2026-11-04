import { Observable, of, Subject } from "rxjs";

import { rereadAt } from "./reread-at";

describe("rereadAt", () => {
  let ticks$: Subject<number>;
  let reads: number;
  let values: number[];

  /** Each read gives the next of `values`; its value is the moment it next changes. */
  const read$ = (): Observable<number> => of(values[reads++]);
  const untilValue = (value: number) => (value < 0 ? undefined : value);

  beforeEach(() => {
    ticks$ = new Subject<number>();
    reads = 0;
  });

  it("emits the first read and runs no clock without a next change", () => {
    values = [-1];
    const seen: number[] = [];

    const subscription = rereadAt(read$, untilValue, ticks$).subscribe((v) => seen.push(v));

    expect(seen).toEqual([-1]);
    expect(ticks$.observed).toBe(false);
    subscription.unsubscribe();
  });

  it("reads again once the next change passes, not before", () => {
    values = [100, -1];
    const seen: number[] = [];
    const subscription = rereadAt(read$, untilValue, ticks$).subscribe((v) => seen.push(v));

    ticks$.next(99);
    expect(reads).toBe(1);

    ticks$.next(100);
    subscription.unsubscribe();

    expect(seen).toEqual([100, -1]);
    expect(ticks$.observed).toBe(false);
  });

  it("schedules each re-read off the value it gave", () => {
    values = [100, 200, 300, -1];
    const seen: number[] = [];
    const subscription = rereadAt(read$, untilValue, ticks$).subscribe((v) => seen.push(v));

    [150, 250, 350, 450].forEach((t) => ticks$.next(t));
    subscription.unsubscribe();

    expect(seen).toEqual([100, 200, 300, -1]);
    expect(reads).toBe(4);
  });

  it("stops the clock once unsubscribed", () => {
    values = [100];
    const subscription = rereadAt(read$, untilValue, ticks$).subscribe();

    subscription.unsubscribe();

    expect(ticks$.observed).toBe(false);
  });
});
