import { BehaviorSubject, ReplaySubject, Subject, firstValueFrom, of, timeout } from "rxjs";

import { ConsoleLogService } from "../../platform/services/console-log.service";
import { consoleSemanticLoggerProvider } from "../log";

import { AchievementHub } from "./achievement-hub";
import { ItemCreatedEarnedEvent, ItemCreatedProgressEvent } from "./examples/achievement-events";
import {
  ItemCreatedTracker,
  TotallyAttachedAchievement,
  TotallyAttachedValidator,
} from "./examples/example-validators";
import { ItemAddedEvent } from "./examples/user-events";
import {
  AchievementEarnedEvent,
  AchievementEvent,
  AchievementId,
  AchievementProgressEvent,
  AchievementValidator,
  MetricId,
  UserActionEvent,
} from "./types";

const testLog = consoleSemanticLoggerProvider(new ConsoleLogService(true), {});

describe("AchievementHub", () => {
  describe("all$", () => {
    it("emits achievements constructor emissions", async () => {
      const validators$ = new Subject<AchievementValidator[]>();
      const events$ = new Subject<UserActionEvent>();
      const achievements$ = new Subject<AchievementEvent>();
      const hub = new AchievementHub(validators$, events$, achievements$);
      const results$ = new ReplaySubject<AchievementEvent>(3);
      achievements$.next(ItemCreatedEarnedEvent);
      achievements$.complete();

      hub.all$().subscribe(results$);

      const result = firstValueFrom(results$);
      await expect(result).resolves.toEqual(ItemCreatedEarnedEvent);
    });

    it("emits achievements derived from events", async () => {
      const validators$ = new BehaviorSubject<AchievementValidator[]>([TotallyAttachedValidator]);
      const events$ = new Subject<UserActionEvent>();
      const achievements$ = new Subject<AchievementEvent>();
      const hub = new AchievementHub(validators$, events$, achievements$, 10, testLog);
      const results$ = new ReplaySubject<AchievementEvent>(3);
      hub.all$().subscribe(results$);

      // hub starts listening when achievements$ completes
      achievements$.complete();
      events$.next(ItemAddedEvent);

      const result = firstValueFrom(results$);
      await expect(result).resolves.toMatchObject({
        achievement: { type: "earned", name: TotallyAttachedAchievement },
      });
    });
  });

  describe("new$", () => {
    it("emits achievements derived from events", async () => {
      const validators$ = new BehaviorSubject<AchievementValidator[]>([TotallyAttachedValidator]);
      const events$ = new Subject<UserActionEvent>();
      const achievements$ = new Subject<AchievementEvent>();
      const hub = new AchievementHub(validators$, events$, achievements$, 10, testLog);
      const results$ = new ReplaySubject<AchievementEvent>(3);
      hub.new$().subscribe(results$);

      // hub starts listening when achievements$ completes
      achievements$.complete();
      events$.next(ItemAddedEvent);

      const result = firstValueFrom(results$);
      await expect(result).resolves.toMatchObject({
        achievement: { type: "earned", name: TotallyAttachedAchievement },
      });
    });

    it("omits achievement emissions before subscription", async () => {
      const validators$ = new Subject<AchievementValidator[]>();
      const events$ = new Subject<UserActionEvent>();
      const achievements$ = new Subject<AchievementEvent>();
      const hub = new AchievementHub(validators$, events$, achievements$, 10, testLog);
      const results$ = new ReplaySubject<AchievementEvent | null>(3);
      achievements$.next(ItemCreatedEarnedEvent);
      achievements$.complete();

      // there are no emissions, so use a timeout to inject a `null` sentinel value
      hub
        .new$()
        .pipe(timeout({ first: 10, with: () => of(null) }))
        .subscribe(results$);

      const result = firstValueFrom(results$);
      await expect(result).resolves.toBeNull();
    });
  });

  describe("earned$", () => {
    it("includes earned achievements from constructor", async () => {
      const validators$ = new Subject<AchievementValidator[]>();
      const events$ = new Subject<UserActionEvent>();
      const achievements$ = new Subject<AchievementEvent>();
      const hub = new AchievementHub(validators$, events$, achievements$, 10, testLog);
      const results$ = new ReplaySubject<Map<AchievementId, AchievementEarnedEvent>>(1);
      hub.earned$().subscribe(results$);

      achievements$.next(ItemCreatedEarnedEvent);
      achievements$.complete();

      const result = await firstValueFrom(results$);
      expect(result.get(ItemCreatedEarnedEvent.achievement.name)).toEqual(ItemCreatedEarnedEvent);
    });

    it("includes earned achievements from validators", async () => {
      const validators$ = new BehaviorSubject<AchievementValidator[]>([TotallyAttachedValidator]);
      const events$ = new Subject<UserActionEvent>();
      const achievements$ = new Subject<AchievementEvent>();
      const hub = new AchievementHub(validators$, events$, achievements$, 10, testLog);
      const results$ = new ReplaySubject<Map<AchievementId, AchievementEarnedEvent>>(1);
      hub.earned$().subscribe(results$);

      achievements$.complete();
      events$.next(ItemAddedEvent);

      const result = await firstValueFrom(results$);
      expect(result.get(TotallyAttachedValidator.achievement)).toMatchObject({
        achievement: { type: "earned", name: TotallyAttachedValidator.achievement },
      });
    });
  });

  describe("metrics$", () => {
    it("includes progress events from constructor", async () => {
      const validators$ = new Subject<AchievementValidator[]>();
      const events$ = new Subject<UserActionEvent>();
      const achievements$ = new Subject<AchievementEvent>();
      const hub = new AchievementHub(validators$, events$, achievements$, 10, testLog);
      const results$ = new ReplaySubject<Map<MetricId, AchievementProgressEvent>>(1);
      hub.metrics$().subscribe(results$);

      achievements$.next(ItemCreatedProgressEvent);
      achievements$.complete();

      const result = await firstValueFrom(results$);
      expect(result.get(ItemCreatedProgressEvent.achievement.name)).toEqual(
        ItemCreatedProgressEvent,
      );
    });

    it("includes progress events from constructor", async () => {
      const validators$ = new BehaviorSubject<AchievementValidator[]>([ItemCreatedTracker]);
      const events$ = new Subject<UserActionEvent>();
      const achievements$ = new Subject<AchievementEvent>();
      const hub = new AchievementHub(validators$, events$, achievements$, 10, testLog);
      const results$ = new ReplaySubject<Map<MetricId, AchievementProgressEvent>>(1);
      hub.metrics$().subscribe(results$);

      achievements$.complete();
      events$.next(ItemAddedEvent);

      const result = await firstValueFrom(results$);
      expect(result.get(ItemCreatedTracker.active.metric)).toMatchObject({
        achievement: { type: "progress", name: ItemCreatedTracker.active.metric, value: 1 },
      });
    });
  });
});
