import { css } from "@emotion/css";
import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { themes } from "../constants/styles";

import { BrandIcon } from "./brand-icon";
import { CloseButton } from "./buttons/close-button";
import { NotificationHeaderMessage } from "./header-message";

export function NotificationHeader({
  isVaultLocked,
  message,
  showBottomBorder,
  theme = ThemeTypes.Light,
  handleCloseNotification,
}: {
  isVaultLocked: boolean;
  message: string;
  showBottomBorder: boolean;
  theme: Theme;
  handleCloseNotification: (e: Event) => void;
}) {
  const showIcon = true;
  const isDismissable = true;

  return html`
    <div class=${notificationHeaderStyles({ showBottomBorder, theme })}>
      ${showIcon ? BrandIcon({ theme }) : null} ${NotificationHeaderMessage({ message, theme })}
      ${isDismissable ? CloseButton({ handleCloseNotification, theme }) : null}
    </div>
  `;
}

const notificationHeaderStyles = ({
  showBottomBorder,
  theme,
}: {
  showBottomBorder: boolean;
  theme: Theme;
}) => css`
  gap: 8px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  background-color: ${themes[theme].background.alt};
  padding: 12px 16px 8px 16px;
  white-space: nowrap;

  ${showBottomBorder
    ? css`
        border-bottom: 0.5px solid ${themes[theme].secondary["300"]};
      `
    : css``}
`;
