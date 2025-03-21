import { BehaviorSubject, Subject } from "rxjs";

import {
  CredentialGeneratedProgressEvent,
  ItemCreatedProgressEvent,
  NextItemCreatedProgressEvent,
  ItemCreatedEarnedEvent,
  NextItemCreatedEarnedEvent,
  ThreeItemsCreatedEarnedEvent,
} from "./examples/achievement-events";
import {
  CredentialGeneratedProgress,
  ItemCreatedAchievement,
  ItemCreatedProgress,
  ThreeItemsCreatedAchievement,
} from "./examples/example-validators";
import { latestEarnedMetrics, latestProgressMetrics } from "./latest-metrics";
import { AchievementEarnedEvent, AchievementId, AchievementProgressEvent, MetricId } from "./types";

describe("latestProgressMetrics", () => {
  it("creates a map containing a metric", () => {
    const subject = new Subject<AchievementProgressEvent>();
    const result = new BehaviorSubject(new Map<MetricId, AchievementProgressEvent>());

    subject.pipe(latestProgressMetrics()).subscribe(result);
    subject.next(ItemCreatedProgressEvent);

    expect(result.value.get(ItemCreatedProgress)).toEqual(ItemCreatedProgressEvent);
  });

  it("creates a map containing multiple metrics", () => {
    const subject = new Subject<AchievementProgressEvent>();
    const result = new BehaviorSubject(new Map<MetricId, AchievementProgressEvent>());

    subject.pipe(latestProgressMetrics()).subscribe(result);
    subject.next(ItemCreatedProgressEvent);
    subject.next(CredentialGeneratedProgressEvent);

    expect(result.value.get(ItemCreatedProgress)).toEqual(ItemCreatedProgressEvent);
    expect(result.value.get(CredentialGeneratedProgress)).toEqual(CredentialGeneratedProgressEvent);
  });

  it("creates a map containing updated metrics", () => {
    const subject = new Subject<AchievementProgressEvent>();
    const result = new BehaviorSubject(new Map<MetricId, AchievementProgressEvent>());

    subject.pipe(latestProgressMetrics()).subscribe(result);
    subject.next(ItemCreatedProgressEvent);
    subject.next(NextItemCreatedProgressEvent);

    expect(result.value.get(ItemCreatedProgress)).toEqual(NextItemCreatedProgressEvent);
  });

  it("omits old events", () => {
    const subject = new Subject<AchievementProgressEvent>();
    const result = new BehaviorSubject(new Map<MetricId, AchievementProgressEvent>());

    subject.pipe(latestProgressMetrics()).subscribe(result);
    subject.next(NextItemCreatedProgressEvent);
    subject.next(ItemCreatedProgressEvent);

    expect(result.value.get(ItemCreatedProgress)).toEqual(NextItemCreatedProgressEvent);
  });
});

describe("latestEarnedMetrics", () => {
  it("creates a map containing a metric", () => {
    const subject = new Subject<AchievementEarnedEvent>();
    const result = new BehaviorSubject(new Map<AchievementId, AchievementEarnedEvent>());

    subject.pipe(latestEarnedMetrics()).subscribe(result);
    subject.next(ItemCreatedEarnedEvent);

    expect(result.value.get(ItemCreatedAchievement)).toEqual(ItemCreatedEarnedEvent);
  });

  it("creates a map containing multiple metrics", () => {
    const subject = new Subject<AchievementEarnedEvent>();
    const result = new BehaviorSubject(new Map<AchievementId, AchievementEarnedEvent>());

    subject.pipe(latestEarnedMetrics()).subscribe(result);
    subject.next(ItemCreatedEarnedEvent);
    subject.next(ThreeItemsCreatedEarnedEvent);

    expect(result.value.get(ItemCreatedAchievement)).toEqual(ItemCreatedEarnedEvent);
    expect(result.value.get(ThreeItemsCreatedAchievement)).toEqual(ThreeItemsCreatedEarnedEvent);
  });

  it("creates a map containing updated metrics", () => {
    const subject = new Subject<AchievementEarnedEvent>();
    const result = new BehaviorSubject(new Map<AchievementId, AchievementEarnedEvent>());

    subject.pipe(latestEarnedMetrics()).subscribe(result);
    subject.next(ItemCreatedEarnedEvent);
    subject.next(NextItemCreatedEarnedEvent);

    expect(result.value.get(ItemCreatedAchievement)).toEqual(NextItemCreatedEarnedEvent);
  });

  it("omits old events", () => {
    const subject = new Subject<AchievementEarnedEvent>();
    const result = new BehaviorSubject(new Map<AchievementId, AchievementEarnedEvent>());

    subject.pipe(latestEarnedMetrics()).subscribe(result);
    subject.next(NextItemCreatedEarnedEvent);
    subject.next(ItemCreatedEarnedEvent);

    expect(result.value.get(ItemCreatedAchievement)).toEqual(NextItemCreatedEarnedEvent);
  });
});
