import { css } from "@emotion/css";
import { html } from "lit";

import { IconProps } from "../common-types";
import { buildIconColorRule, ruleNames, themes } from "../constants/styles";

export function User({ color, disabled, theme }: IconProps) {
  const shapeColor = disabled ? themes[theme].secondary["300"] : color || themes[theme].text.main;

  return html`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" fill="none">
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        d="M13.51 12.189a6.616 6.616 0 0 0-4.524-4.915 3.87 3.87 0 0 0 1.968-3.348 3.926 3.926 0 1 0-7.852 0 3.864 3.864 0 0 0 1.95 3.338A6.61 6.61 0 0 0 .49 12.189 1.499 1.499 0 0 0 1.962 14h10.077a1.503 1.503 0 0 0 1.471-1.812ZM4.044 3.926A2.987 2.987 0 0 1 7.592.963a2.985 2.985 0 0 1-.563 5.916 2.973 2.973 0 0 1-2.985-2.953Zm8.427 8.938a.548.548 0 0 1-.436.204H1.962a.548.548 0 0 1-.432-.204.576.576 0 0 1-.119-.486 5.724 5.724 0 0 1 9.175-3.23 5.723 5.723 0 0 1 2.003 3.23.571.571 0 0 1-.118.486Z"
      />
    </svg>
  `;
}
