import { Jsonify } from "type-fest";

import { NOTIFICATION_DISK, UserKeyDefinition } from "@bitwarden/common/platform/state";

import { NotificationViewData } from "../models";

export const NOTIFICATIONS = UserKeyDefinition.array<NotificationViewData>(
  NOTIFICATION_DISK,
  "notifications",
  {
    deserializer: (notification: Jsonify<NotificationViewData>) =>
      NotificationViewData.fromJSON(notification),
    clearOn: ["logout", "lock"],
  },
);
