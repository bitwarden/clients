import { OperatorFunction, pipe, scan } from "rxjs";

import { MetricId, AchievementProgressEvent, AchievementId, AchievementEarnedEvent } from "./types";

function latestProgressMetrics(): OperatorFunction<
  AchievementProgressEvent,
  Map<MetricId, AchievementProgressEvent>
> {
  return pipe(
    scan((metrics, captured) => {
      const metric = metrics.get(captured.achievement.name);

      // omit stale metrics
      if (metric && metric["@timestamp"] > captured["@timestamp"]) {
        return metrics;
      }

      metrics.set(captured.achievement.name, captured);

      return metrics;
    }, new Map<MetricId, AchievementProgressEvent>()),
  );
}

function latestEarnedMetrics(): OperatorFunction<
  AchievementEarnedEvent,
  Map<AchievementId, AchievementEarnedEvent>
> {
  return pipe(
    scan((metrics, captured) => {
      const metric = metrics.get(captured.achievement.name);

      // omit stale metrics
      if (metric && metric["@timestamp"] > captured["@timestamp"]) {
        return metrics;
      }

      metrics.set(captured.achievement.name, captured);
      return metrics;
    }, new Map<AchievementId, AchievementEarnedEvent>()),
  );
}

export { latestProgressMetrics, latestEarnedMetrics };
