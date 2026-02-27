import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { themes } from "../../constants/styles";

export type AtRiskNotificationMessageProps = {
  message?: string;
  theme: Theme;
};

export function AtRiskNotificationMessage({ message, theme }: AtRiskNotificationMessageProps) {
  return html`
    <div>
      ${message
        ? html`
            <span title=${message} class=${atRiskNotificationMessageStyles(theme)}>
              ${message}
            </span>
          `
        : nothing}
    </div>
  `;
}

const baseTextStyles = css`
  overflow-x: hidden;
  text-align: left;
  text-overflow: ellipsis;
  line-height: 24px;
  font-family: Inter, sans-serif;
  font-size: 16px;
`;

const atRiskNotificationMessageStyles = (theme: Theme) => css`
  ${baseTextStyles}

  color: ${themes[theme].text.main};
  font-weight: 400;
  white-space: normal;
  word-break: break-word;
  display: inline;
`;
