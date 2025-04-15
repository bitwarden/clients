import { css } from "@emotion/css";
import { html } from "lit";

import { IconProps } from "../common-types";
import { buildIconColorRule, ruleNames, themes } from "../constants/styles";

export function Users({ color, disabled, theme }: IconProps) {
  const shapeColor = disabled ? themes[theme].secondary["300"] : color || themes[theme].text.main;

  return html`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 14" fill="none">
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        d="M6.5 2.5c0 .375-.082.73-.23 1.049A2.986 2.986 0 0 1 8 3c.644 0 1.241.203 1.73.549a2.5 2.5 0 1 1 3.925.825 4 4 0 0 1 1.173.846c.372.387.667.847.867 1.352.201.506.305 1.047.305 1.595 0 .46-.373.833-.833.833H11a4.987 4.987 0 0 1 1.62 2.087A5 5 0 0 1 13 13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1 5 5 0 0 1 2-4H.833A.833.833 0 0 1 0 8.167c0-.548.103-1.09.304-1.595.202-.505.496-.965.868-1.352.339-.353.736-.64 1.173-.846A2.5 2.5 0 1 1 6.5 2.5ZM4 3.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm1.401 4a2.986 2.986 0 0 1-.389-1.771A2.404 2.404 0 0 0 4 5.5c-.32 0-.638.065-.936.194-.3.13-.575.32-.81.565A2.682 2.682 0 0 0 1.579 7.5h3.822Zm5.198 0h3.822a2.682 2.682 0 0 0-.674-1.24 2.493 2.493 0 0 0-.81-.566 2.362 2.362 0 0 0-1.95.035 2.987 2.987 0 0 1-.39 1.771ZM12 3.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm-4 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm3.464 5a3.5 3.5 0 0 0-6.928 0h6.928Z"
      />
    </svg>
  `;
}
