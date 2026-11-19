import type { PamNotificationEvent } from "./pam-notification-diff";

/**
 * Where decided events go to reach the user, so the diffing stays free of any platform's
 * notification API. The text a sink shows must stay generic: no item, folder or person names.
 */
export abstract class PamNotificationSink {
  abstract notify(events: PamNotificationEvent[]): Promise<void>;
}
