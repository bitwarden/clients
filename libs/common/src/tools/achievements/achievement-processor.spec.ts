import { BehaviorSubject, ReplaySubject, bufferCount, concat, first, firstValueFrom } from "rxjs";

import { validate } from "./achievement-processor";
import { ItemCreatedProgressEvent } from "./examples/achievement-events";
import {
  ItemCreatedAchievement,
  ItemCreatedProgress,
  ItemCreatedTracker,
  ItemCreatedValidator,
  TotallyAttachedAchievement,
  TotallyAttachedValidator,
} from "./examples/example-validators";
import { itemAdded$, itemUpdated$ } from "./examples/user-events";
import { AchievementEvent } from "./types";

describe("event-processor", () => {
  describe("validate", () => {
    it("earns an achievement", async () => {
      const validators$ = new BehaviorSubject([TotallyAttachedValidator]);
      const captured$ = new BehaviorSubject<AchievementEvent[]>([]);
      const achievements$ = new ReplaySubject<AchievementEvent>(2);
      const result = firstValueFrom(achievements$.pipe(bufferCount(2)));

      itemAdded$.pipe(validate(validators$, captured$)).subscribe(achievements$);

      const expected = [{ achievement: { type: "earned", name: TotallyAttachedAchievement } }];
      await expect(result).resolves.toMatchObject(expected);
    });

    it("tracks achievement progress", async () => {
      const validators$ = new BehaviorSubject([ItemCreatedTracker]);
      const captured$ = new BehaviorSubject<AchievementEvent[]>([]);
      const achievements$ = new ReplaySubject<AchievementEvent>(2);
      const result = firstValueFrom(achievements$.pipe(bufferCount(2)));

      itemAdded$.pipe(validate(validators$, captured$)).subscribe(achievements$);

      const expected = [{ achievement: { type: "progress", name: ItemCreatedProgress, value: 1 } }];
      await expect(result).resolves.toMatchObject(expected);
    });

    it("updates achievement progress", async () => {
      const validators$ = new BehaviorSubject([ItemCreatedTracker]);
      const captured$ = new BehaviorSubject<AchievementEvent[]>([ItemCreatedProgressEvent]);
      const achievements$ = new ReplaySubject<AchievementEvent>(2);
      const result = firstValueFrom(achievements$.pipe(bufferCount(2)));

      itemAdded$.pipe(validate(validators$, captured$)).subscribe(achievements$);

      const expected = [{ achievement: { type: "progress", name: ItemCreatedProgress, value: 2 } }];
      await expect(result).resolves.toMatchObject(expected);
    });

    it("tracks achievement progress and earns an achievement", async () => {
      const validators$ = new BehaviorSubject([ItemCreatedValidator]);
      const captured$ = new BehaviorSubject<AchievementEvent[]>([]);
      const achievements$ = new ReplaySubject<AchievementEvent>(3);
      const result = firstValueFrom(achievements$.pipe(bufferCount(3)));

      itemAdded$.pipe(validate(validators$, captured$)).subscribe(achievements$);

      // NOTE: `progress` always comes before `earned`, but the order of individual
      // progress or earned entries is not guaranteed.
      const expected = [
        { achievement: { type: "progress", name: ItemCreatedProgress, value: 1 } },
        { achievement: { type: "earned", name: ItemCreatedAchievement } },
      ];
      await expect(result).resolves.toMatchObject(expected);
    });

    it("skips records that fail the validator's filter criteria", async () => {
      const validators$ = new BehaviorSubject([ItemCreatedTracker]);
      const captured$ = new BehaviorSubject<AchievementEvent[]>([]);
      const achievements$ = new ReplaySubject<AchievementEvent>(2);
      const result = firstValueFrom(achievements$.pipe(bufferCount(2)));

      // `ItemCreatedTracker` filters out update events
      concat(itemUpdated$, itemAdded$)
        .pipe(validate(validators$, captured$))
        .subscribe(achievements$);

      const expected = [{ achievement: { type: "progress", name: ItemCreatedProgress, value: 1 } }];
      await expect(result).resolves.toMatchObject(expected);
    });

    it("only emits when its validators return events", async () => {
      const validators$ = new BehaviorSubject([ItemCreatedTracker]);
      const captured$ = new BehaviorSubject<AchievementEvent[]>([]);
      const achievements$ = new BehaviorSubject<AchievementEvent | null | undefined>(undefined);

      // `ItemCreatedTracker` filters `itemUpdated$` emissions. There are no others
      // to process. When `itemUpdated$` completes, `first()` emits `null`, which
      // replaces the `undefined` value in `achievements$`.
      concat(itemUpdated$)
        .pipe(validate(validators$, captured$), first(null, null))
        .subscribe(achievements$);

      await expect(achievements$.value).toBeNull();
    });
  });
});
