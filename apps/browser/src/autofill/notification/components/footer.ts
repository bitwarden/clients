import { css } from "@emotion/css";
import { html, TemplateResult } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { spacing, themes } from "../constants/styles";

export function NotificationFooter({
  theme = ThemeTypes.Light,
  children,
}: {
  theme: Theme;
  children: TemplateResult[];
}) {
  return html` <div class=${footerStyles({ theme })}>${children}</div> `;
}

const footerStyles = ({ theme }: { theme: Theme }) => css`
  background-color: ${themes[theme].background.alt};
  padding: ${spacing["1.5"]} 16px 16px 16px;

  :last-child {
    border-radius: 0 0 ${spacing["4"]} ${spacing["4"]};
  }
`;
