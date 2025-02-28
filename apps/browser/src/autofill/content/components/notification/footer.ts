import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import {
  NotificationType,
  NotificationTypes,
} from "../../../notification/abstractions/notification-bar";
import { spacing, themes } from "../constants/styles";
import { ActionRow } from "../rows/action-row";
import { ButtonRow } from "../rows/button-row";

export function NotificationFooter({
  handleSaveAction,
  notificationType,
  theme,
  i18n,
}: {
  handleSaveAction: (e: Event) => void;
  i18n: { [key: string]: string };
  notificationType?: NotificationType;
  theme: Theme;
}) {
  const isChangeNotification = notificationType === NotificationTypes.Change;
  const saveNewItemText = i18n.saveAsNewLoginAction;
  const buttonText = i18n.saveAction;

  return html`
    <div class=${notificationFooterStyles({ theme })}>
      ${isChangeNotification
        ? ActionRow({
            itemText: saveNewItemText,
            handleAction: handleSaveAction,
            theme,
          })
        : ButtonRow({ theme, buttonAction: handleSaveAction, buttonText })}
    </div>
  `;
}

const notificationFooterStyles = ({ theme }: { theme: Theme }) => css`
  display: flex;
  background-color: ${themes[theme].background.alt};
  padding: 0 ${spacing[3]} ${spacing[3]} ${spacing[3]};

  :last-child {
    border-radius: 0 0 ${spacing["4"]} ${spacing["4"]};
  }
`;
