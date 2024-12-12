import { Theme } from "@bitwarden/common/platform/enums";

import { NotificationTypes } from "../../abstractions/notification-bar";
import { BadgeButton } from "../buttons/badge-button";
import { EditButton } from "../buttons/edit-button";

export function CipherAction({
  handleAction = () => {
    /* no-op */
  },
  notificationType,
  theme,
}: {
  handleAction?: (e: Event) => void;
  notificationType: typeof NotificationTypes.Change | typeof NotificationTypes.Add;
  theme: Theme;
}) {
  return notificationType === NotificationTypes.Change
    ? BadgeButton({
        buttonAction: handleAction,
        // @TODO localize
        buttonText: "Update item",
        theme,
      })
    : EditButton({
        buttonAction: handleAction,
        // @TODO localize
        buttonText: "Edit item",
        theme,
      });
}
