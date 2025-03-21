import {
  Observable,
  ReplaySubject,
  Subject,
  concat,
  filter,
  map,
  shareReplay,
  startWith,
  tap,
} from "rxjs";

import { SemanticLogger, disabledSemanticLoggerProvider } from "../log";

import { active } from "./achievement-manager";
import { achievements } from "./achievement-processor";
import { latestEarnedMetrics, latestProgressMetrics } from "./latest-metrics";
import { isEarnedEvent, isProgressEvent } from "./meta";
import {
  AchievementEarnedEvent,
  AchievementEvent,
  AchievementId,
  AchievementProgressEvent,
  AchievementValidator,
  MetricId,
  UserActionEvent,
} from "./types";

export class AchievementHub {
  /** Instantiates the achievement hub. A new achievement hub should be created
   *   per-user, and streams should be partitioned by user.
   *  @param validators$ emits the most recent achievement validator list and
   *     re-emits the full list when the validators change.
   *  @param events$ emits events captured from the system as they occur. THIS
   *     OBSERVABLE IS SUBSCRIBED DURING INITIALIZATION. It must emit a complete
   *     event to prevent the event hub from leaking the subscription.
   *  @param achievements$ emits the list of achievement events captured before
   *     initialization and then completes.  THIS OBSERVABLE IS SUBSCRIBED DURING
   *     INITIALIZATION. Achievement processing begins once this observable
   *     completes.
   *  @param bufferSize the maximum number of achievement events retained by the
   *     achievement hub.
   */
  constructor(
    validators$: Observable<AchievementValidator[]>,
    events$: Observable<UserActionEvent>,
    achievements$: Observable<AchievementEvent>,
    bufferSize: number = 1000,
    private log: SemanticLogger = disabledSemanticLoggerProvider({}),
  ) {
    this.achievements = new Subject<AchievementEvent>();
    this.achievementLog = new ReplaySubject<AchievementEvent>(bufferSize);
    this.achievements.subscribe(this.achievementLog);

    const metrics$ = this.metrics$().pipe(
      map((m) => new Map(Array.from(m.entries(), ([k, v]) => [k, v.achievement.value] as const))),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    const earned$ = this.earned$().pipe(map((m) => new Set(m.keys())));
    const active$ = validators$.pipe(active(metrics$, earned$));

    // TODO: figure out how to to unsubscribe from the event stream;
    //   this likely requires accepting an account-bound observable, which
    //   would also let the hub maintain it's "one user" invariant.
    concat(achievements$, events$.pipe(achievements(active$, metrics$))).subscribe(
      this.achievements,
    );
  }

  private readonly achievements: Subject<AchievementEvent>;
  private readonly achievementLog: ReplaySubject<AchievementEvent>;

  /** emit all achievement events */
  all$(): Observable<AchievementEvent> {
    return this.achievementLog.asObservable();
  }

  /** emit achievement events received after subscription */
  new$(): Observable<AchievementEvent> {
    return this.achievements.asObservable();
  }

  earned$(): Observable<Map<AchievementId, AchievementEarnedEvent>> {
    return this.achievementLog.pipe(
      filter(isEarnedEvent),
      latestEarnedMetrics(),
      tap((m) => this.log.debug(m, "earned achievements update")),
      startWith(new Map<AchievementId, AchievementEarnedEvent>()),
    );
  }

  metrics$(): Observable<Map<MetricId, AchievementProgressEvent>> {
    return this.achievementLog.pipe(
      filter(isProgressEvent),
      latestProgressMetrics(),
      tap((m) => this.log.debug(m, "achievement metrics update")),
      startWith(new Map<MetricId, AchievementProgressEvent>()),
    );
  }
}
