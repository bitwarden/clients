import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { NotificationBarIframeInitData } from "../../../../notification/abstractions/notification-bar";
import { I18n } from "../../common-types";
import { themes, spacing } from "../../constants/styles";
import {
  NotificationHeader,
  componentClassPrefix as notificationHeaderClassPrefix,
} from "../header";

import { AtRiskNotificationBody } from "./body";
import { AtRiskNotificationFooter } from "./footer";

export type AtRiskNotificationProps = NotificationBarIframeInitData & {
  handleCloseNotification: (e: Event) => void;
} & {
  i18n: I18n;
  notificationTestId: string;
};

export function AtRiskNotification({
  handleCloseNotification,
  i18n,
  notificationTestId,
  theme = ThemeTypes.Light,
  params,
}: AtRiskNotificationProps) {
  const { passwordChangeUri, organizationName } = params;
  const riskMessage = chrome.i18n.getMessage(
    passwordChangeUri ? "atRiskChangePrompt" : "atRiskNavigatePrompt",
    organizationName,
  );

  return html`
    <div data-testid="${notificationTestId}" class=${atRiskNotificationContainerStyles(theme)}>
      ${NotificationHeader({
        handleCloseNotification,
        i18n,
        message: i18n.atRiskPassword,
        theme,
      })}
      ${AtRiskNotificationBody({
        theme,
        riskMessage,
      })}
      ${passwordChangeUri
        ? AtRiskNotificationFooter({
            i18n,
            theme,
            passwordChangeUri: params?.passwordChangeUri,
          })
        : nothing}
    </div>
  `;
}

const atRiskNotificationContainerStyles = (theme: Theme) => css`
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
