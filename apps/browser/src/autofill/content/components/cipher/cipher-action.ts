import { Theme } from "@bitwarden/common/platform/enums";

import { BadgeButton } from "../../../content/components/buttons/badge-button";
import { EditButton } from "../../../content/components/buttons/edit-button";
import { NotificationTypes } from "../../../notification/abstractions/notification-bar";

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
