import { BehaviorSubject, filter, from } from "rxjs";

import { Account } from "../../auth/abstractions/account.service";
import { UserEventCollector } from "../log/user-event-collector";

import { AchievementHub } from "./achievement-hub";
import { AchievementService } from "./achievement.service.abstraction";
import { TotallyAttachedValidator } from "./examples/example-validators";
import { isEarnedEvent, isProgressEvent } from "./meta";
import { Achievement, AchievementEvent, AchievementValidator } from "./types";
import { ItemCreatedCountConfig } from "./validators/config/item-created-count-config";
import { VaultItemCreatedCountValidator } from "./validators/vault-item-created-count-validator";

export class DefaultAchievementService implements AchievementService {
  constructor(private readonly collector: UserEventCollector) {}

  private hubs = new Map<string, AchievementHub>();

  private getHub(account: Account) {
    if (!this.hubs.has(account.id)) {
      // FIXME: sync these from the server and load them
      const validators$ = new BehaviorSubject<AchievementValidator[]>([
        TotallyAttachedValidator,
        ...VaultItemCreatedCountValidator.createValidators(ItemCreatedCountConfig.AllConfigs),
      ]);

      // FIXME: load stored achievements
      const achievements$ = from([] as AchievementEvent[]);
      const events$ = this.collector.events$(account);
      const hub = new AchievementHub(validators$, events$, achievements$);

      this.hubs.set(account.id, hub);
    }

    return this.hubs.get(account.id)!;
  }

  private _achievements: Achievement[] = [
    TotallyAttachedValidator,
    ...ItemCreatedCountConfig.AllConfigs,
  ];

  achievementMap() {
    return new Map(this._achievements.map((a) => [a.achievement, a] as const));
  }

  earnedStream$(account: Account, all: boolean = false) {
    const hub = this.getHub(account);
    if (all) {
      return hub.all$().pipe(filter(isEarnedEvent));
    } else {
      return hub.new$().pipe(filter(isEarnedEvent));
    }
  }

  earnedMap$(account: Account) {
    return this.getHub(account).earned$();
  }

  progressStream$(account: Account, all: boolean = false) {
    const hub = this.getHub(account);
    if (all) {
      return hub.all$().pipe(filter(isProgressEvent));
    } else {
      return hub.new$().pipe(filter(isProgressEvent));
    }
  }

  metricsMap$(account: Account) {
    return this.getHub(account).metrics$();
  }
}
