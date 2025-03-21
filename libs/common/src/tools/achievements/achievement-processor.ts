import { Observable, OperatorFunction, concatMap, from, map, pipe, withLatestFrom } from "rxjs";

import {
  AchievementEvent,
  AchievementId,
  AchievementProgressEvent,
  AchievementValidator,
  MetricId,
  UserActionEvent,
} from "./types";

/** Monitors a user activity stream to recognize achievements
 *  @param validators$ validators track achievement progress and award achievements
 *  @param metrics$ the set of previously emitted achievement events
 */
function achievements(
  validators$: Observable<AchievementValidator[]>,
  metrics$: Observable<Map<MetricId, number>>,
): OperatorFunction<UserActionEvent, AchievementEvent> {
  return pipe(
    withLatestFrom(validators$),
    // narrow the list of all live monitors to just those that may produce new logs
    map(([action, monitors]) => {
      const triggered = monitors.filter((m) => m.trigger(action));
      return [action, triggered] as const;
    }),
    withLatestFrom(metrics$),
    // monitor achievements
    concatMap(([[action, validators], metrics]) => {
      const achievements: AchievementEvent[] = [];
      const progress = new Map<AchievementId, AchievementProgressEvent[]>();

      // collect measurements
      for (const validator of validators) {
        const measured = validator.measure?.(action, metrics) ?? [];
        progress.set(validator.achievement, measured);

        achievements.push(...measured);
      }

      // update processor's internal progress values
      const distinct = new Map<MetricId, AchievementId>();
      const entries = [...progress.entries()].flatMap(([a, ms]) => ms.map((m) => [a, m] as const));
      for (const [achievement, measured] of entries) {
        const key = measured.achievement.name;

        // prevent duplicate updates
        if (distinct.has(key)) {
          // FIXME Currently skipping this error for demo purposes
          // const msg = `${achievement} failed to set ${key}; value already set by ${distinct.get(key)}`;
          // throw new Error(msg);
        } else {
          distinct.set(key, achievement);
        }

        metrics.set(measured.achievement.name, measured.achievement.value);
      }

      // detect earned achievements
      for (const validator of validators) {
        const events = progress.get(validator.achievement) ?? [];
        const awarded = validator.award?.(events, metrics) ?? [];

        achievements.push(...awarded);
      }

      // deliver results as a stream containing individual records to maintain
      // the map/reduce model of the validator
      return from(achievements);
    }),
  );
}

export { achievements, achievements as validate };
