import { BehaviorSubject, ReplaySubject, Subject, firstValueFrom } from "rxjs";

import { active } from "./achievement-manager";
import {
  ItemCreatedTracker,
  TotallyAttachedValidator,
  UnboundItemCreatedTracker,
} from "./examples/example-validators";
import { AchievementId, AchievementValidator, MetricId } from "./types";

describe("active", () => {
  it("passes through empty achievement sets", async () => {
    const metrics$ = new BehaviorSubject<Map<MetricId, number>>(new Map());
    const earned$ = new BehaviorSubject<Set<AchievementId>>(new Set());
    const validators$ = new Subject<AchievementValidator[]>();
    const results$ = new ReplaySubject<AchievementValidator[]>(1);

    validators$.pipe(active(metrics$, earned$)).subscribe(results$);
    const results = firstValueFrom(results$);
    validators$.next([]);

    await expect(results).resolves.toEqual([]);
  });

  it("passes through until-earned validators when earned$ omits the achievement id", async () => {
    const metrics$ = new BehaviorSubject<Map<MetricId, number>>(new Map());
    const earned$ = new BehaviorSubject<Set<AchievementId>>(new Set());
    const validators$ = new Subject<AchievementValidator[]>();
    const results$ = new ReplaySubject<AchievementValidator[]>(1);

    validators$.pipe(active(metrics$, earned$)).subscribe(results$);
    const results = firstValueFrom(results$);
    validators$.next([TotallyAttachedValidator]);

    await expect(results).resolves.toEqual([TotallyAttachedValidator]);
  });

  it("filters until-earned validators when earned$ includes the achievement id", async () => {
    const metrics$ = new BehaviorSubject<Map<MetricId, number>>(new Map());
    const earned$ = new BehaviorSubject<Set<AchievementId>>(
      new Set([TotallyAttachedValidator.achievement]),
    );
    const validators$ = new Subject<AchievementValidator[]>();
    const results$ = new ReplaySubject<AchievementValidator[]>(1);

    validators$.pipe(active(metrics$, earned$)).subscribe(results$);
    const results = firstValueFrom(results$);
    validators$.next([TotallyAttachedValidator]);

    await expect(results).resolves.toEqual([]);
  });

  it("passes through threshold validators when metric$ omits its metric and the low threshold isn't defined", async () => {
    const metrics$ = new BehaviorSubject<Map<MetricId, number>>(new Map());
    const earned$ = new BehaviorSubject<Set<AchievementId>>(
      new Set([ItemCreatedTracker.achievement]),
    );
    const validators$ = new Subject<AchievementValidator[]>();
    const results$ = new ReplaySubject<AchievementValidator[]>(1);

    validators$.pipe(active(metrics$, earned$)).subscribe(results$);
    const results = firstValueFrom(results$);
    validators$.next([ItemCreatedTracker]);

    await expect(results).resolves.toEqual([ItemCreatedTracker]);
  });

  it("passes through threshold validators when metric$ includes a metric below the validator's `high` threshold", async () => {
    const metrics$ = new BehaviorSubject<Map<MetricId, number>>(
      new Map([[ItemCreatedTracker.active.metric, 0]]),
    );
    const earned$ = new BehaviorSubject<Set<AchievementId>>(
      new Set([ItemCreatedTracker.achievement]),
    );
    const validators$ = new Subject<AchievementValidator[]>();
    const results$ = new ReplaySubject<AchievementValidator[]>(1);

    validators$.pipe(active(metrics$, earned$)).subscribe(results$);
    const results = firstValueFrom(results$);
    validators$.next([ItemCreatedTracker]);

    await expect(results).resolves.toEqual([ItemCreatedTracker]);
  });

  it("filters threshold validators when metric$ includes a metric equal to the validator's `high` threshold", async () => {
    const metrics$ = new BehaviorSubject<Map<MetricId, number>>(
      new Map([[ItemCreatedTracker.active.metric, 1]]),
    );
    const earned$ = new BehaviorSubject<Set<AchievementId>>(
      new Set([ItemCreatedTracker.achievement]),
    );
    const validators$ = new Subject<AchievementValidator[]>();
    const results$ = new ReplaySubject<AchievementValidator[]>(1);

    validators$.pipe(active(metrics$, earned$)).subscribe(results$);
    const results = firstValueFrom(results$);
    validators$.next([ItemCreatedTracker]);

    await expect(results).resolves.toEqual([]);
  });

  it("filters threshold validators when metric$ includes a metric greater than the validator's `high` threshold", async () => {
    const metrics$ = new BehaviorSubject<Map<MetricId, number>>(
      new Map([[ItemCreatedTracker.active.metric, 2]]),
    );
    const earned$ = new BehaviorSubject<Set<AchievementId>>(
      new Set([ItemCreatedTracker.achievement]),
    );
    const validators$ = new Subject<AchievementValidator[]>();
    const results$ = new ReplaySubject<AchievementValidator[]>(1);

    validators$.pipe(active(metrics$, earned$)).subscribe(results$);
    const results = firstValueFrom(results$);
    validators$.next([ItemCreatedTracker]);

    await expect(results).resolves.toEqual([]);
  });

  it("passes through threshold validators when metric$ includes a metric equal to the validator's `low` threshold", async () => {
    const metrics$ = new BehaviorSubject<Map<MetricId, number>>(
      new Map([[UnboundItemCreatedTracker.active.metric, 2]]),
    );
    const earned$ = new BehaviorSubject<Set<AchievementId>>(
      new Set([UnboundItemCreatedTracker.achievement]),
    );
    const validators$ = new Subject<AchievementValidator[]>();
    const results$ = new ReplaySubject<AchievementValidator[]>(1);

    validators$.pipe(active(metrics$, earned$)).subscribe(results$);
    const results = firstValueFrom(results$);
    validators$.next([UnboundItemCreatedTracker]);

    await expect(results).resolves.toEqual([UnboundItemCreatedTracker]);
  });

  it("filters threshold validators when metric$ includes a metric below to the validator's `low` threshold", async () => {
    const metrics$ = new BehaviorSubject<Map<MetricId, number>>(
      new Map([[UnboundItemCreatedTracker.active.metric, 0]]),
    );
    const earned$ = new BehaviorSubject<Set<AchievementId>>(
      new Set([UnboundItemCreatedTracker.achievement]),
    );
    const validators$ = new Subject<AchievementValidator[]>();
    const results$ = new ReplaySubject<AchievementValidator[]>(1);

    validators$.pipe(active(metrics$, earned$)).subscribe(results$);
    const results = firstValueFrom(results$);
    validators$.next([UnboundItemCreatedTracker]);

    await expect(results).resolves.toEqual([]);
  });
});
