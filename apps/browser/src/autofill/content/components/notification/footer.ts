import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import {
  NotificationType,
  NotificationTypes,
} from "../../../notification/abstractions/notification-bar";
import { OrgView, FolderView, CollectionView } from "../common-types";
import { spacing, themes } from "../constants/styles";

import { NotificationButtonRow } from "./button-row";

export type NotificationFooterProps = {
  collections?: CollectionView[];
  folders?: FolderView[];
  i18n: { [key: string]: string };
  notificationType?: NotificationType;
  organizations?: OrgView[];
  personalVaultIsAllowed: boolean;
  theme: Theme;
  handleSaveAction: (e: Event) => void;
};

export function NotificationFooter({
  collections,
  folders,
  i18n,
  notificationType,
  organizations,
  personalVaultIsAllowed,
  theme,
  handleSaveAction,
}: NotificationFooterProps) {
  const isChangeNotification = notificationType === NotificationTypes.Change;
  const primaryButtonText = i18n.saveAction;

  return html`
    <div class=${notificationFooterStyles({ theme })}>
      ${!isChangeNotification
        ? NotificationButtonRow({
            collections,
            folders,
            organizations,
            i18n,
            primaryButton: {
              handlePrimaryButtonClick: handleSaveAction,
              text: primaryButtonText,
            },
            personalVaultIsAllowed,
            theme,
          })
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
