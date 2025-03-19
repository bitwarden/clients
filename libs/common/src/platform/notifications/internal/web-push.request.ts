export class WebPushRequest {
  endpoint: string | undefined;
  p256dh: string | undefined;
  auth: string | undefined;

  static from(pushSubscription: PushSubscriptionJSON): WebPushRequest {
    const result = new WebPushRequest();
    result.endpoint = pushSubscription.endpoint;
    result.p256dh = pushSubscription.keys?.p256dh;
    result.auth = pushSubscription.keys?.auth;
    return result;
  }
}
