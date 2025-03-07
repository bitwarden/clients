import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import {
  NotificationType,
  NotificationTypes,
} from "../../../notification/abstractions/notification-bar";
import { OrgView, FolderView } from "../common-types";
import { spacing, themes } from "../constants/styles";
import { ActionRow } from "../rows/action-row";

import { NotificationButtonRow } from "./button-row";

export type NotificationFooterProps = {
  folders?: FolderView[];
  i18n: { [key: string]: string };
  notificationType?: NotificationType;
  organizations?: OrgView[];
  theme: Theme;
  handleSaveAction: (e: Event) => void;
};

export function NotificationFooter({
  folders,
  i18n,
  notificationType,
  organizations,
  theme,
  handleSaveAction,
}: NotificationFooterProps) {
  const isChangeNotification = notificationType === NotificationTypes.Change;
  const saveNewItemText = i18n.saveAsNewLoginAction;
  const primaryButtonText = i18n.saveAction;

  return html`
    <div class=${notificationFooterStyles({ theme })}>
      ${isChangeNotification
        ? ActionRow({
            itemText: saveNewItemText,
            handleAction: handleSaveAction,
            theme,
          })
        : NotificationButtonRow({
            folders,
            organizations,
            primaryButton: {
              handlePrimaryButtonClick: handleSaveAction,
              text: primaryButtonText,
            },
            theme,
          })}
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
