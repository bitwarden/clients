import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

export default class BrowserMessagingPrivateModeBackgroundService implements MessagingService {
  send(subscriber: string, arg: any = {}) {
    const message = Object.assign({}, { command: subscriber }, arg);
    (self as any).bitwardenPopupMainMessageListener(message);
  }
}
