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
  notificationType,
  theme,
}: {
  notificationType?: NotificationType;
  theme: Theme;
}) {
  const isChangeNotification = notificationType === NotificationTypes.Change;
  // @TODO localize
  const saveNewItemText = "Save as new login";

  return html`
    <div class=${notificationFooterStyles({ theme })}>
      ${isChangeNotification
        ? ActionRow({ itemText: saveNewItemText, handleAction: () => {}, theme })
        : ButtonRow({ theme })}
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
