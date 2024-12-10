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
  notificationType: string;
  theme: Theme;
}) {
  return notificationType === NotificationTypes.Change
    ? BadgeButton({
        buttonAction: handleAction,
        // @TODO localize
        buttonText: "Update item",
        theme,
      })
    : notificationType === NotificationTypes.Add
      ? EditButton({
          buttonAction: handleAction,
          // @TODO localize
          buttonText: "Edit item",
          theme,
        }) // @TODO add handleAction
      : null; // @TODO null case should be handled by parent
}
