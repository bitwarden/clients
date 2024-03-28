import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

export default class BrowserMessagingPrivateModePopupService implements MessagingService {
  send(subscriber: string, arg: any = {}) {
    const message = Object.assign({}, { command: subscriber }, arg);
    (self as any).bitwardenBackgroundMessageListener(message);
  }
}
