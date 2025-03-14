import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import {
  NotificationType,
  NotificationTypes,
} from "../../../notification/abstractions/notification-bar";
import { spacing, themes } from "../constants/styles";
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
  const buttonText = i18n.saveAction;

  return html`
    <div class=${notificationFooterStyles({ theme })}>
      ${!isChangeNotification
        ? ButtonRow({ theme, buttonAction: handleSaveAction, buttonText })
        : nothing}
    </div>
  `;
}

const notificationFooterStyles = ({ theme }: { theme: Theme }) => css`
  display: flex;
  background-color: ${themes[theme].background.alt};
  padding: 0 ${spacing[3]} ${spacing[3]} ${spacing[3]};

  :last-child {
    border-radius: 0 0 ${spacing["4"]} ${spacing["4"]};
    padding-bottom: ${spacing[4]};
  }
`;
