import { css } from "@emotion/css";
import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { themes } from "../constants/styles";

import { CloseButton } from "./Buttons/close-button";
import { BrandIcon } from "./brand-icon";
import { NotificationHeaderMessage } from "./header-message";

export function NotificationHeader({
  handleCloseNotification,
  hasBody,
  isVaultLocked,
  message,
  theme = ThemeTypes.Light,
}: {
  handleCloseNotification: (e: Event) => void;
  hasBody: boolean;
  isVaultLocked: boolean;
  message: string;
  theme: Theme;
}) {
  const showIcon = true;
  const isDismissable = true;

  return html`
    <div class=${headerStyles({ hasBody, theme })}>
      ${showIcon ? BrandIcon({ isVaultLocked }) : null}
      ${NotificationHeaderMessage({ message, theme })}
      ${isDismissable ? CloseButton({ handleCloseNotification, theme }) : null}
    </div>
  `;
}

const headerStyles = ({ hasBody, theme }: { hasBody: boolean; theme: Theme }) => css`
  gap: 8px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 12px 16px 8px 16px;
  white-space: nowrap;

  ${hasBody
    ? css`
        border-bottom: 0.5px solid ${themes[theme].secondary["300"]};
      `
    : css``}
`;
