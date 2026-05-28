import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { themes, typography } from "../../constants/styles";

export type ChangePasswordReminderMessageProps = {
  message?: string;
  theme: Theme;
};

export function ChangePasswordReminderMessage({
  message,
  theme,
}: ChangePasswordReminderMessageProps) {
  return html`
    <div>
      ${message
        ? html`
            <span title=${message} class=${changePasswordReminderMessageStyles(theme)}>
              ${message}
            </span>
          `
        : nothing}
    </div>
  `;
}

const baseTextStyles = css`
  ${typography.body2}

  overflow-x: hidden;
  text-align: left;
  text-overflow: ellipsis;
`;

const changePasswordReminderMessageStyles = (theme: Theme) => css`
  ${baseTextStyles}

  color: ${themes[theme].text.main};
  font-weight: 400;
  white-space: normal;
  word-break: break-word;
  display: inline;
`;
