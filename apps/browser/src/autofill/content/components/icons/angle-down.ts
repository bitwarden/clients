import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { buildIconColorRule, ruleNames, themes } from "../constants/styles";

export function AngleDown({
  color,
  disabled,
  theme,
}: {
  color?: string;
  disabled?: boolean;
  theme: Theme;
}) {
  const shapeColor = disabled ? themes[theme].secondary["300"] : color || themes[theme].text.main;

  return html`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 12" fill="none">
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        d="M12.004 11.244a2.705 2.705 0 0 1-1.75-.644L.266 2.154a.76.76 0 0 1-.263-.51.75.75 0 0 1 1.233-.637l9.99 8.445a1.186 1.186 0 0 0 1.565 0l10-8.54a.751.751 0 0 1 .973 1.141l-10 8.538a2.703 2.703 0 0 1-1.76.653Z"
      />
    </svg>
  `;
}
