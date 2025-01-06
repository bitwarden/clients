import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { buildIconColorRule, ruleNames, themes } from "../constants/styles";

export function Family({
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
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 18" fill="none">
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        d="M20.535 8.219a4.5 4.5 0 1 0-5.07 0c-.34.187-.657.414-.945.675a3 3 0 0 0-5.04 0 5.745 5.745 0 0 0-.945-.675 4.5 4.5 0 1 0-5.07 0A7.5 7.5 0 0 0 0 13.829C0 14.34.135 15 .645 15H8.07a6.6 6.6 0 0 0-.57 2.055c0 .405.105.945.48.945h7.83c.48 0 .735-.345.66-.945A7.503 7.503 0 0 0 15.93 15h7.17c.645 0 .975-.42.885-1.17a7.5 7.5 0 0 0-3.45-5.61ZM15 4.499a3 3 0 1 1 6 0 3 3 0 0 1-6 0Zm-3 4.5a1.5 1.5 0 0 1 1.5 1.11c.016.13.016.26 0 .39a1.5 1.5 0 0 1-.99 1.395 1.29 1.29 0 0 1-1.02 0 1.5 1.5 0 0 1-.99-1.395 1.778 1.778 0 0 1 0-.39A1.5 1.5 0 0 1 12 9Zm-9-4.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0Zm-1.425 9C2.13 10.71 4.08 9 6.075 9A4.035 4.035 0 0 1 9 10.499a3 3 0 0 0 .945 2.145A4.499 4.499 0 0 0 9 13.5H1.575Zm13.29 3h-5.73A5.07 5.07 0 0 1 9.75 15 2.865 2.865 0 0 1 12 13.5h.15a2.82 2.82 0 0 1 2.16 1.5c.27.465.457.972.555 1.5Zm.135-3a4.5 4.5 0 0 0-.945-.825A3 3 0 0 0 15 10.5 4.08 4.08 0 0 1 18 9a5.01 5.01 0 0 1 4.41 4.5H15Z"
      />
    </svg>
  `;
}
