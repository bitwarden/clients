import { Theme } from "@bitwarden/common/platform/enums";

import { BadgeButton } from "../../../content/components/buttons/badge-button";
import { EditButton } from "../../../content/components/buttons/edit-button";
import { NotificationTypes } from "../../../notification/abstractions/notification-bar";

export function CipherAction({
  handleAction = () => {
    /* no-op */
  },
  i18n,
  notificationType,
  theme,
}: {
  handleAction?: (e: Event) => void;
  i18n: { [key: string]: string };
  notificationType: typeof NotificationTypes.Change | typeof NotificationTypes.Add;
  theme: Theme;
}) {
  return notificationType === NotificationTypes.Change
    ? BadgeButton({
        buttonAction: handleAction,
        buttonText: i18n.notificationUpdate,
        theme,
      })
    : EditButton({
        buttonAction: handleAction,
        buttonText: i18n.notificationEditTooltip,
        theme,
      });
}
