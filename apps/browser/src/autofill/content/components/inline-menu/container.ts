import { css } from "@emotion/css";
import { html, TemplateResult } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { spacing, themes } from "../constants/styles";

export type InlineMenuContainerProps = {
  children: TemplateResult | TemplateResult[];
  dataTestId?: string;
  theme: Theme;
};

export function InlineMenuContainer({ children, dataTestId, theme }: InlineMenuContainerProps) {
  return html`
    <div data-testid="${dataTestId}" class=${inlineMenuContainerStyles(theme)}>${children}</div>
  `;
}

const inlineMenuContainerStyles = (theme: Theme) => css`
  box-sizing: border-box;
  overflow: hidden;
  width: 100%;
  border: 1px solid ${themes[theme].secondary["300"]};
  border-radius: ${spacing["1"]};
  background-color: ${themes[theme].background.DEFAULT};
  color: ${themes[theme].text.main};
`;
