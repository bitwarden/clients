import { Observable, OperatorFunction, combineLatestWith, map, pipe, withLatestFrom } from "rxjs";

import { AchievementId, AchievementValidator, MetricId } from "./types";

// computes the list of live achievements; those whose trigger conditions
// aren't met are excluded from the active set
function active(
  metrics$: Observable<ReadonlyMap<MetricId, number>>,
  earned$: Observable<ReadonlySet<AchievementId>>,
  // TODO: accept a configuration observable that completes without
  //       emission when the user has opted out of achievements
): OperatorFunction<AchievementValidator[], AchievementValidator[]> {
  return pipe(
    // refresh when an achievement is earned, but not when metrics
    // update; this may cause metrics to overrun
    combineLatestWith(earned$),
    withLatestFrom(metrics$),

    // filter validators to active set
    map(([[monitors, earned], metrics]) => {
      // compute list of active achievements
      const active = monitors.filter((m) => {
        // 🧠 the filters could be lifted into a function argument & delivered
        //    as a `Map<FilterType, (monitor) => bool>

        if (m.active === "until-earned") {
          // monitor disabled if already achieved
          return !earned.has(m.achievement);
        }

        // monitor disabled if outside of threshold
        const progress = (m.active.metric && metrics.get(m.active.metric)) || 0;
        if (progress >= (m.active.high ?? Number.POSITIVE_INFINITY)) {
          return false;
        } else if (progress < (m.active.low ?? 0)) {
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
