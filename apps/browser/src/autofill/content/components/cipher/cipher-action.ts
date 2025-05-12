import { Theme } from "@bitwarden/common/platform/enums";

import { BadgeButton } from "../../../content/components/buttons/badge-button";
import { EditButton } from "../../../content/components/buttons/edit-button";
import { NotificationTypes } from "../../../notification/abstractions/notification-bar";
import { I18n } from "../common-types";

export type CipherActionProps = {
  handleAction?: (e: Event) => void;
  i18n: I18n;
  notificationType: typeof NotificationTypes.Change | typeof NotificationTypes.Add;
  theme: Theme;
};

export function CipherAction({
  handleAction = () => {
    /* no-op */
  },
  i18n,
  notificationType,
  theme,
}: CipherActionProps) {
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
