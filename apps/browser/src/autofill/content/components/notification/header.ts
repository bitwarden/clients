import createEmotion from "@emotion/css/create-instance";
import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { CloseButton } from "../buttons/close-button";
import { I18n } from "../common-types";
import { spacing, themes } from "../constants/styles";
import { BrandIconContainer } from "../icons/brand-icon-container";

import { NotificationHeaderMessage } from "./header-message";

export const componentClassPrefix = "notification-header";

const { css } = createEmotion({
  key: componentClassPrefix,
});

export type NotificationHeaderProps = {
  i18n: I18n;
  message?: string;
  standalone?: boolean;
  theme: Theme;
  handleCloseNotification: (e: Event) => void;
};

export function NotificationHeader({
  i18n,
  message,
  standalone = false,
  theme = ThemeTypes.Light,
  handleCloseNotification,
}: NotificationHeaderProps) {
  const showIcon = true;
  const isDismissable = true;

  return html`
    <div class=${notificationHeaderStyles({ standalone, theme })}>
      ${showIcon ? BrandIconContainer({ theme }) : null}
      ${message ? NotificationHeaderMessage({ message, theme }) : null}
      ${isDismissable ? CloseButton({ handleCloseNotification, i18n, theme }) : null}
    </div>
  `;
}

const notificationHeaderStyles = ({
  standalone,
  theme,
}: {
  standalone: boolean;
  theme: Theme;
}) => css`
  gap: ${spacing[2]};
  display: flex;
  align-items: center;
  justify-content: flex-start;
  background-color: ${themes[theme].background.DEFAULT};
  padding: 12px 16px 8px 16px;
  white-space: nowrap;

  ${standalone
    ? css``
    : css`
        border-bottom: 0.5px solid ${themes[theme].secondary["300"]};
      `}
`;
