import { css } from "@emotion/css";
import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { I18n } from "../../common-types";
import { spacing, themes } from "../../constants/styles";
import {
  NotificationHeader,
  componentClassPrefix as notificationHeaderClassPrefix,
} from "../header";

export type SsoLoginEntry = {
  username: string;
  provider: string;
};

export type ExistingLoginNotificationProps = {
  ssoLogins: SsoLoginEntry[];
  handleCloseNotification: (e: Event) => void;
  i18n: I18n;
  notificationTestId: string;
  theme?: Theme;
};

export function ExistingLoginNotification({
  ssoLogins,
  handleCloseNotification,
  i18n,
  notificationTestId,
  theme = ThemeTypes.Light,
}: ExistingLoginNotificationProps) {
  return html`
    <div data-testid="${notificationTestId}" class=${containerStyles(theme)}>
      ${NotificationHeader({
        handleCloseNotification,
        i18n,
        message: `Existing SSO login${ssoLogins.length > 1 ? "s" : ""} found`,
        theme,
      })}
      <div class=${bodyStyles(theme)}>
        ${ssoLogins.map(
          ({ username, provider }) => html`
            <div class=${rowStyles(theme)}>
              <span class=${usernameStyles(theme)}>${username}</span>
              <span class=${providerStyles(theme)}>${provider}</span>
            </div>
          `,
        )}
      </div>
    </div>
  `;
}

const containerStyles = (theme: Theme) => css`
  position: absolute;
  right: 20px;
  border: 1px solid ${themes[theme].secondary["300"]};
  border-radius: ${spacing["4"]};
  box-shadow: -2px 4px 6px 0px #0000001a;
  background-color: ${themes[theme].background.alt};
  width: 400px;
  overflow: hidden;

  [class*="${notificationHeaderClassPrefix}-"] {
    border-radius: ${spacing["4"]} ${spacing["4"]} 0 0;
    border-bottom: 0.5px solid ${themes[theme].secondary["300"]};
  }
`;

const bodyStyles = (theme: Theme) => css`
  padding: 8px 12px;
  background-color: ${themes[theme].background.alt};
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const rowStyles = (theme: Theme) => css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  border-bottom: 0.5px solid ${themes[theme].secondary["300"]};

  &:last-child {
    border-bottom: none;
  }
`;

const usernameStyles = (theme: Theme) => css`
  color: ${themes[theme].text.main};
  font-size: 13px;
`;

const providerStyles = (theme: Theme) => css`
  color: ${themes[theme].text.muted};
  font-size: 12px;
  font-style: italic;
`;
