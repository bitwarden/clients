import { Theme } from "@bitwarden/common/platform/enums";

import { BadgeButton } from "../../../content/components/buttons/badge-button";
import { EditButton } from "../../../content/components/buttons/edit-button";
import { NotificationTypes } from "../../../notification/abstractions/notification-bar";
import { I18n } from "../common-types";
import { selectedCipher as selectedCipherSignal } from "../signals/selected-cipher";

export type CipherActionProps = {
  cipherId: string;
  handleAction?: (e: Event) => void;
  i18n: I18n;
  itemName: string;
  notificationType: typeof NotificationTypes.Change | typeof NotificationTypes.Add;
  theme: Theme;
  username?: string;
};

export function CipherAction({
  cipherId,
  handleAction = () => {
    /* no-op */
  },
  i18n,
  itemName,
  notificationType,
  theme,
  username,
}: CipherActionProps) {
  const selectCipherHandleAction = (e: Event) => {
    selectedCipherSignal.set(cipherId);
    try {
      handleAction(e);
    } finally {
      selectedCipherSignal.set(null);
    }
  };
  return notificationType === NotificationTypes.Change
    ? BadgeButton({
        buttonAction: selectCipherHandleAction,
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
