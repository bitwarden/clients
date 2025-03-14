import { Observable, OperatorFunction, map, pipe, withLatestFrom } from "rxjs";

import { isEarnedEvent } from "./meta";
import { AchievementEvent, AchievementValidator } from "./types";
import { mapProgressByName } from "./util";

// computes the list of live achievements; those whose trigger conditions
// aren't met are excluded from the active set
function active(
  status$: Observable<AchievementEvent[]>,
): OperatorFunction<AchievementValidator[], AchievementValidator[]> {
  return pipe(
    withLatestFrom(status$),
    map(([monitors, log]) => {
      // partition the log into progress and earned achievements
      const progressByName = mapProgressByName(log);
      const earnedByName = new Set(
        log.filter((e) => isEarnedEvent(e)).map((e) => e.achievement.name),
      );

      // compute list of active achievements
      const active = monitors.filter((m) => {
        // 🧠 the filters could be lifted into a function argument & delivered
        //    as a `Map<FilterType, (monitor) => bool>

        if (m.trigger === "once") {
          // monitor disabled if already achieved
          return !earnedByName.has(m.achievement);
        }

        // monitor disabled if outside of threshold
        const progress = (m.metric && progressByName.get(m.metric)) || 0;
        if (progress > (m.trigger.high ?? Number.POSITIVE_INFINITY)) {
          return false;
        } else if (progress < (m.trigger.low ?? 0)) {
          return false;
        }

        // otherwise you're within the threshold, so the monitor is active
        return true;
      });

      return active;
    }),
  );
}

export { active };
