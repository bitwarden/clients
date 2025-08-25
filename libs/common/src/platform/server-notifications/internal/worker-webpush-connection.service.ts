import {
  concat,
  concatMap,
  defer,
  distinctUntilChanged,
  fromEvent,
  map,
  Observable,
  Subject,
  Subscription,
  switchMap,
  withLatestFrom,
} from "rxjs";

import { PushTechnology } from "../../../enums/push-technology.enum";
import { NotificationResponse } from "../../../models/response/notification.response";
import { UserId } from "../../../types/guid";
import { ConfigService } from "../../abstractions/config/config.service";
import { SupportStatus } from "../../misc/support-status";
import { Utils } from "../../misc/utils";
import { KeyDefinition, StateProvider, WEB_PUSH_SUBSCRIPTION } from "../../state";

import { WebPushNotificationsApiService } from "./web-push-notifications-api.service";
import { WebPushConnectionService, WebPushConnector } from "./webpush-connection.service";

// Ref: https://w3c.github.io/push-api/#the-pushsubscriptionchange-event
interface PushSubscriptionChangeEvent {
  readonly newSubscription?: PushSubscription;
  readonly oldSubscription?: PushSubscription;
}

// Ref: https://developer.mozilla.org/en-US/docs/Web/API/PushMessageData
interface PushMessageData {
  json(): any;
}

// Ref: https://developer.mozilla.org/en-US/docs/Web/API/PushEvent
interface PushEvent {
  data: PushMessageData;
}

/**
 * An implementation for connecting to web push based server notifications running in a Worker.
 */
export class WorkerWebPushConnectionService implements WebPushConnectionService {
  private pushEvent = new Subject<PushEvent>();
  private pushChangeEvent = new Subject<PushSubscriptionChangeEvent>();

  constructor(
    private readonly configService: ConfigService,
    private readonly webPushApiService: WebPushNotificationsApiService,
    private readonly serviceWorkerRegistration: ServiceWorkerRegistration,
    private readonly stateProvider: StateProvider,
  ) {}

  start(): Subscription {
    const subscription = new Subscription(() => {
      this.pushEvent.complete();
      this.pushChangeEvent.complete();
      this.pushEvent = new Subject<PushEvent>();
      this.pushChangeEvent = new Subject<PushSubscriptionChangeEvent>();
    });

    const pushEventSubscription = fromEvent<PushEvent>(self, "push").subscribe(this.pushEvent);

    const pushChangeEventSubscription = fromEvent<PushSubscriptionChangeEvent>(
      self,
      "pushsubscriptionchange",
    ).subscribe(this.pushChangeEvent);

    subscription.add(pushEventSubscription);
    subscription.add(pushChangeEventSubscription);

    return subscription;
  }

  supportStatus$(userId: UserId): Observable<SupportStatus<WebPushConnector>> {
    // Check the server config to see if it supports sending WebPush server notifications
    // FIXME: get config of server for the specified userId, once ConfigService supports it
    return this.configService.serverConfig$.pipe(
      map((config) =>
        config?.push?.pushTechnology === PushTechnology.WebPush ? config.push.vapidPublicKey : null,
      ),
      // No need to re-emit when there is new server config if the vapidPublicKey is still there and the exact same
      distinctUntilChanged(),
      map((publicKey) => {
        if (publicKey == null) {
          return {
            type: "not-supported",
            reason: "server-not-configured",
          } satisfies SupportStatus<WebPushConnector>;
        }

        return {
          type: "supported",
          service: new MyWebPushConnector(
            publicKey,
            userId,
            this.webPushApiService,
            this.serviceWorkerRegistration,
            this.pushEvent,
            this.pushChangeEvent,
            this.stateProvider,
          ),
        } satisfies SupportStatus<WebPushConnector>;
      }),
    );
  }
}

class MyWebPushConnector implements WebPushConnector {
  notifications$: Observable<NotificationResponse>;

  constructor(
    private readonly vapidPublicKey: string,
    private readonly userId: UserId,
    private readonly webPushApiService: WebPushNotificationsApiService,
    private readonly serviceWorkerRegistration: ServiceWorkerRegistration,
    private readonly pushEvent$: Observable<PushEvent>,
    private readonly pushChangeEvent$: Observable<PushSubscriptionChangeEvent>,
    private readonly stateProvider: StateProvider,
  ) {
    const subscriptionUsersState = this.stateProvider.getGlobal(WEB_PUSH_SUBSCRIPTION_USERS);
    this.notifications$ = this.getOrCreateSubscription$(this.vapidPublicKey).pipe(
      withLatestFrom(subscriptionUsersState.state$.pipe(map((x) => x ?? {}))),
      concatMap(async ([[isExistingSubscription, subscription], subscriptionUsers]) => {
        if (subscription == null) {
          throw new Error("Expected a non-null subscription.");
        }

        // If this is a new subscription, we can clear state and start over
        if (!isExistingSubscription) {
          subscriptionUsers = {};
        }

        // If the user is already subscribed, we don't need to do anything
        if (subscriptionUsers[subscription.endpoint]?.includes(this.userId)) {
          return;
        }
        subscriptionUsers[subscription.endpoint] ??= [];
        subscriptionUsers[subscription.endpoint].push(this.userId);
        // Update the state with the new subscription-user association
        await subscriptionUsersState.update(() => subscriptionUsers);

        // Inform the server about the new subscription-user association
        await this.webPushApiService.putSubscription(subscription.toJSON());
      }),
      switchMap(() => this.pushEvent$),
      map((e) => {
        return new NotificationResponse(e.data.json().data);
      }),
    );
  }

  private async pushManagerSubscribe(key: string) {
    return await this.serviceWorkerRegistration.pushManager.subscribe({
      userVisibleOnly: false,
      applicationServerKey: key,
    });
  }

  private getOrCreateSubscription$(key: string) {
    return concat(
      defer(async () => {
        const existingSubscription =
          await this.serviceWorkerRegistration.pushManager.getSubscription();

        if (existingSubscription == null) {
          return [false, await this.pushManagerSubscribe(key)] as const;
        }

        const subscriptionKey = Utils.fromBufferToUrlB64(
          // REASON: `Utils.fromBufferToUrlB64` handles null by returning null back to it.
          // its annotation should be updated and then this assertion can be removed.
          // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
          existingSubscription.options?.applicationServerKey!,
        );

        if (subscriptionKey !== key) {
          // There is a subscription, but it's not for the current server, unsubscribe and then make a new one
          await existingSubscription.unsubscribe();
          return [false, await this.pushManagerSubscribe(key)] as const;
        }

        return [true, existingSubscription] as const;
      }),
      this.pushChangeEvent$.pipe(map((event) => [false, event.newSubscription] as const)),
    );
  }
}

export const WEB_PUSH_SUBSCRIPTION_USERS = new KeyDefinition<Record<string, UserId[]>>(
  WEB_PUSH_SUBSCRIPTION,
  "subUsers",
  {
    deserializer: (obj) => {
      if (obj == null) {
        return {};
      }

      const result: Record<string, UserId[]> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = Array.isArray(value) ? value : [];
      }
      return result;
    },
  },
);
