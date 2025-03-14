import { RequireAtLeastOne } from "type-fest";
import { Tagged } from "type-fest/source/opaque";

import { EventFormat, ServiceFormat, UserFormat } from "../log/ecs-format";

import { Type } from "./data";

export type ValidatorId = keyof typeof Type;
export type AchievementId = string & Tagged<"achievement">;
export type MetricId = string & Tagged<"metric-id">;

// validators require all events to contain this baseline information
export type UserActionEvent = EventFormat & UserFormat & ServiceFormat;

export type AchievementProgressEvent = EventFormat &
  ServiceFormat &
  UserFormat & { achievement: { type: "progress"; name: MetricId; value: number } };
export type AchievementEarnedEvent = EventFormat &
  ServiceFormat &
  UserFormat & { achievement: { type: "earned"; name: AchievementId } };
export type AchievementEvent = AchievementProgressEvent | AchievementEarnedEvent;

// consumed by validator and achievement list (should this include a "toast-alerter"?)
export type Achievement = {
  // identifies the achievement being monitored
  achievement: AchievementId;

  // human-readable name of the achievement
  name: string;

  // human-readable description of the achievement
  description?: string;

  // the metric observed by low/high triggers
  metric?: MetricId;

  // identifies the validator containing filter/measure/earn methods
  validator: ValidatorId;

  // pre-filter that disables the rule if it's met
  trigger: "once" | RequireAtLeastOne<{ low: number; high: number }>;

  // whether or not the achievement is hidden until it is earned
  hidden: boolean;
};

// consumed by validator
export type AchievementValidator = Achievement & {
  // when the watch triggers on incoming user events
  filter: (item: EventFormat) => boolean;

  // observe data from the event stream and produces measurements
  measure?: (item: EventFormat, metrics: Map<MetricId, number>) => AchievementProgressEvent[];

  // monitors achievement progress and emits earned achievements
  award?: (
    events: AchievementProgressEvent[],
    metrics: Map<MetricId, number>,
  ) => AchievementEarnedEvent[];
};
