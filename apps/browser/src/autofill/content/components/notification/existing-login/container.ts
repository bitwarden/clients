import { css } from "@emotion/css";
import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { I18n } from "../../common-types";
import { spacing, themes } from "../../constants/styles";
import {
  NotificationHeader,
  componentClassPrefix as notificationHeaderClassPrefix,
} from "../header";

export type ExistingLoginNotificationProps = {
  cipherNames: string[];
  handleCloseNotification: (e: Event) => void;
  i18n: I18n;
  notificationTestId: string;
  theme?: Theme;
};

export function ExistingLoginNotification({
  cipherNames,
  handleCloseNotification,
  i18n,
  notificationTestId,
  theme = ThemeTypes.Light,
}: ExistingLoginNotificationProps) {
  const message =
    cipherNames.length === 1
      ? `You have a saved login for this site: ${cipherNames[0]}`
      : `You have ${cipherNames.length} saved logins for this site: ${cipherNames.join(", ")}`;

  return html`
    <div data-testid="${notificationTestId}" class=${containerStyles(theme)}>
      ${NotificationHeader({
        handleCloseNotification,
        i18n,
        message: "Existing login found",
        theme,
      })}
      <div class=${bodyStyles(theme)}>${message}</div>
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
  padding: 12px;
  background-color: ${themes[theme].background.alt};
  color: ${themes[theme].text.main};
  font-size: 14px;
`;
