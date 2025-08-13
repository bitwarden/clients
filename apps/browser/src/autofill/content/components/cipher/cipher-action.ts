import { Theme } from "@bitwarden/common/platform/enums";

import { BadgeButton } from "../../../content/components/buttons/badge-button";
import { EditButton } from "../../../content/components/buttons/edit-button";
import { NotificationTypes } from "../../../notification/abstractions/notification-bar";
import { I18n } from "../common-types";

export type CipherActionProps = {
  handleAction?: (e: Event) => void;
  i18n: I18n;
  itemName: string;
  notificationType: typeof NotificationTypes.Change | typeof NotificationTypes.Add;
  theme: Theme;
  username?: string;
};

export function CipherAction({
  handleAction = () => {
    /* no-op */
  },
  i18n,
  itemName,
  notificationType,
  theme,
  username,
}: CipherActionProps) {
  return notificationType === NotificationTypes.Change
    ? BadgeButton({
        buttonAction: handleAction,
        buttonText: i18n.notificationUpdate,
        itemName,
        theme,
        username,
      })
    : EditButton({
        buttonAction: handleAction,
        buttonText: i18n.notificationEditTooltip,
        theme,
      });
}
