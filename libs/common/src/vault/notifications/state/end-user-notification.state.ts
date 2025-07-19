import { NOTIFICATION_DISK, UserKeyDefinition } from "@bitwarden/common/platform/state";

import { NotificationViewData } from "../models";

export const NOTIFICATIONS = UserKeyDefinition.array<NotificationViewData>(
  NOTIFICATION_DISK,
  "notifications",
  {
    deserializer: (notification) => NotificationViewData.fromJSON(notification!),
    clearOn: ["logout", "lock"],
  },
);
