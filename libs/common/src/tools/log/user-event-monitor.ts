import { BehaviorSubject, SubjectLike, from, map, of, zip } from "rxjs";
import { Primitive } from "type-fest";

import { Account } from "../../auth/abstractions/account.service";
import { AppIdService } from "../../platform/abstractions/app-id.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { UserActionEvent } from "../achievements/types";

import { ServiceFormat, UserFormat, EcsEventType } from "./ecs-format";
import { disabledSemanticLoggerProvider } from "./factory";
import { SemanticLogger } from "./semantic-logger.abstraction";

type BaselineType = Omit<ServiceFormat & UserFormat, "@timestamp">;

export type EventInfo = {
  action: string;
  labels?: Record<string, Primitive>;
  tags?: Array<string>;
};

export class UserEventMonitor {
  constructor(
    idService: AppIdService,
    utilService: PlatformUtilsService,
    private account: Account,
    private now: () => number,
    private events$: SubjectLike<UserActionEvent>,
    private log: SemanticLogger = disabledSemanticLoggerProvider({}),
  ) {
    zip(
      from(idService.getAppId()),
      from(utilService.getApplicationVersion()),
      of(utilService.getDeviceString()),
    )
      .pipe(map(([appId, version, device]) => this.template(appId, device, version)))
      .subscribe((next) => this.baseline$.next(next));
  }

  template(appId: string, device: string, version: string): BaselineType {
    return {
      event: {
        kind: "event",
        category: "session",
      },
      service: {
        name: device,
        type: "client",
        node: {
          name: appId,
        },
        version,
      },
      user: {
        id: this.account.id,
        email: (this.account.emailVerified && this.account.email) || undefined,
      },
    };
  }

  private readonly baseline$ = new BehaviorSubject<BaselineType | null>(null);

  creation(event: EventInfo) {
    this.collect("creation", event);
  }

  deletion(event: EventInfo) {
    this.collect("deletion", event);
  }

  info(event: EventInfo) {
    this.collect("info", event);
  }

  access(event: EventInfo) {
    this.collect("access", event);
  }

  private collect(type: EcsEventType, info: EventInfo) {
    const { value: baseline } = this.baseline$;

    if (!baseline) {
      // TODO: buffer logs and stream them when `baseline$` becomes available.
      this.log.error("baseline log not available; dropping user event");
      return;
    }

    const event = structuredClone(this.baseline$.value) as UserActionEvent;
    event["@timestamp"] = this.now();

    event.event.type = type;
    event.action = info.action;
    event.tags = info.tags && info.tags.filter((t) => !!t);

    if (info.labels) {
      const entries = Object.keys(info.labels)
        .filter((k) => !!info.labels![k])
        .map((k) => [k, info.labels![k]] as const);
      const labels = Object.fromEntries(entries);
      event.labels = labels;
    }

    this.events$.next(event);
  }
}
