import { css } from "@emotion/css";
import { html, TemplateResult } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { spacing, themes, typography } from "../constants/styles";

export function NotificationBody({
  theme = ThemeTypes.Light,
  children,
}: {
  theme: Theme;
  children: TemplateResult[];
}) {
  return html` <div class=${notificationBodyStyles({ theme })}>${children}</div> `;
}

const notificationBodyStyles = ({ theme }: { theme: Theme }) => css`
  ${typography.body1}

  gap: ${spacing["1.5"]};
  display: flex;
  flex-flow: column;
  background-color: ${themes[theme].background.alt};
  padding: ${spacing["3"]};
  max-height: 123px;
  overflow-x: hidden;
  overflow-y: auto;
  white-space: nowrap;
  color: ${themes[theme].text.main};
  font-weight: 400;

  :last-child {
    border-radius: 0 0 ${spacing["4"]} ${spacing["4"]};
  }
`;
