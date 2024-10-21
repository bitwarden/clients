import {
  concat,
  concatMap,
  defer,
  fromEvent,
  map,
  Observable,
  of,
  Subject,
  Subscription,
  switchMap,
} from "rxjs";

import { PushTechnology } from "../../../enums/push-technology.enum";
import { NotificationResponse } from "../../../models/response/notification.response";
import { UserId } from "../../../types/guid";
import { ConfigService } from "../../abstractions/config/config.service";
import { SupportStatus } from "../../misc/support-status";
import { Utils } from "../../misc/utils";
import { WebPushNotificationsApiService } from "../../services/notifications/web-push-notifications-api.service";

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
 * An implementation for connecting to web push based notifications running in a Worker.
 */
export class WorkerWebPushConnectionService implements WebPushConnectionService {
  private pushEvent = new Subject<PushEvent>();
  private pushChangeEvent = new Subject<PushSubscriptionChangeEvent>();

  constructor(
    private readonly configService: ConfigService,
    private readonly webPushApiService: WebPushNotificationsApiService,
    private readonly serviceWorkerRegistration: ServiceWorkerRegistration,
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
    // Check the server config to see if it supports sending WebPush notifications
    return this.configService.serverConfig$.pipe<SupportStatus<WebPushConnector>>(
      map((config) => {
        if (config.push?.pushTechnology === PushTechnology.WebPush) {
          return {
            type: "supported",
            service: new MyWebPushConnector(
              config.push.vapidPublicKey,
              userId,
              this.webPushApiService,
              this.serviceWorkerRegistration,
              this.pushEvent,
              this.pushChangeEvent,
            ),
          };
        }

        return { type: "not-supported", reason: "server-not-configured" };
      }),
    );
  }
}

class MyWebPushConnector implements WebPushConnector {
  constructor(
    private readonly vapidPublicKey: string,
    private readonly userId: UserId,
    private readonly webPushApiService: WebPushNotificationsApiService,
    private readonly serviceWorkerRegistration: ServiceWorkerRegistration,
    private readonly pushEvent$: Observable<PushEvent>,
    private readonly pushChangeEvent$: Observable<PushSubscriptionChangeEvent>,
  ) {}

  connect$(): Observable<NotificationResponse> {
    return this.getOrCreateSubscription$(this.vapidPublicKey).pipe(
      concatMap((subscription) => {
        return defer(() => this.webPushApiService.putSubscription(subscription.toJSON())).pipe(
          switchMap(() => this.pushEvent$),
          map((e) => new NotificationResponse(e.data.json().data)),
        );
      }),
    );
  }

  private pushManagerSubscribe$(key: string) {
    return defer(
      async () =>
        await this.serviceWorkerRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        }),
    );
  }

  private getOrCreateSubscription$(key: string) {
    return concat(
      defer(async () => await this.serviceWorkerRegistration.pushManager.getSubscription()).pipe(
        concatMap((subscription) => {
          if (subscription == null) {
            return this.pushManagerSubscribe$(key);
          }

          const subscriptionKey = Utils.fromBufferToUrlB64(
            subscription.options?.applicationServerKey,
          );
          if (subscriptionKey !== key) {
            // There is a subscription, but it's not for the current server, unsubscribe and then make a new one
            return defer(() => subscription.unsubscribe()).pipe(
              concatMap(() => this.pushManagerSubscribe$(key)),
            );
          }

          return of(subscription);
        }),
      ),
      this.pushChangeEvent$.pipe(
        concatMap((event) => {
          // TODO: Is this enough, do I need to do something with oldSubscription
          return of(event.newSubscription);
        }),
      ),
    );
  }
}
