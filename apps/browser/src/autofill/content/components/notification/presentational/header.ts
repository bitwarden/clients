import createEmotion from "@emotion/css/create-instance";
import { html } from "lit";
import { noop } from "rxjs";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { CloseButton } from "../../buttons/close-button";
import { themes } from "../../constants/styles";
import { BrandIconContainer } from "../../icons/brand-icon-container";

import { NotificationHeaderMessage } from "./../header-message";

export const componentClassPrefix = "notification-header";

const { css } = createEmotion({
  key: componentClassPrefix,
});

export function PresentationalNotificationHeader({
  message,
  standalone = false,
  theme = ThemeTypes.Light,
  handleCloseNotification = noop,
}: {
  message?: string;
  standalone?: boolean;
  theme?: Theme;
  handleCloseNotification?: (e: Event) => void;
}) {
  const showIcon = true;
  const isDismissable = true;

  return html`
    <div class=${notificationHeaderStyles({ standalone, theme })}>
      ${showIcon ? BrandIconContainer({ theme }) : null}
      ${message ? NotificationHeaderMessage({ message, theme }) : null}
      ${isDismissable ? CloseButton({ handleCloseNotification, theme, i18n: {} }) : null}
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
  gap: 8px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  background-color: ${themes[theme].background.DEFAULT};
  padding: 12px 16px 8px 16px;
  white-space: nowrap;

  ${standalone
    ? css`
        border-bottom: 0.5px solid ${themes[theme].secondary["300"]};
      `
    : css``}
`;
