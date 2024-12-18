import { ApiService } from "../../../abstractions/api.service";
import { AppIdService } from "../../abstractions/app-id.service";

import { WebPushRequest } from "./web-push.request";

export class WebPushNotificationsApiService {
  constructor(
    private readonly apiService: ApiService,
    private readonly appIdService: AppIdService,
  ) {}

  /**
   * Posts a device-user association to the server and ensures it's installed for push notifications
   */
  async putSubscription(pushSubscription: PushSubscriptionJSON): Promise<void> {
    const request = WebPushRequest.from(pushSubscription);
    await this.apiService.send(
      "POST",
      `/devices/identifier/${await this.appIdService.getAppId()}/web-push-auth`,
      request,
      true,
      false,
    );
  }
}
