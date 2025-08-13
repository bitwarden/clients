import createEmotion from "@emotion/css/create-instance";
import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { spacing, themes } from "../../constants/styles";
import { Warning } from "../../illustrations";

import { AtRiskNotificationMessage } from "./message";

export const componentClassPrefix = "at-risk-notification-body";

const { css } = createEmotion({
  key: componentClassPrefix,
});

export type AtRiskNotificationBodyProps = {
  riskMessage: string;
  theme: Theme;
};

export function AtRiskNotificationBody({ riskMessage, theme }: AtRiskNotificationBodyProps) {
  return html`
    <div class=${atRiskNotificationBodyStyles({ theme })}>
      <div class=${iconContainerStyles}>${Warning()}</div>
      ${riskMessage
        ? AtRiskNotificationMessage({
            message: riskMessage,
            theme,
          })
        : nothing}
    </div>
  `;
}

const iconContainerStyles = css`
  > svg {
    width: 50px;
    height: auto;
  }
`;
const atRiskNotificationBodyStyles = ({ theme }: { theme: Theme }) => css`
  gap: ${spacing[4]};
  display: flex;
  align-items: center;
  justify-content: flex-start;
  background-color: ${themes[theme].background.alt};
  padding: 12px;
`;
