import { css } from "@emotion/css";
import { html } from "lit";

import { IconProps } from "../common-types";
import { buildIconColorRule, ruleNames, themes } from "../constants/styles";

export function User({ ariaHidden = true, color, disabled, theme }: IconProps) {
  const shapeColor = disabled ? themes[theme].secondary["300"] : color || themes[theme].text.main;

  return html`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 14 15"
      fill="none"
      aria-hidden="${ariaHidden}"
    >
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        d="M9.203 7.339a4 4 0 1 0-4.407 0A7.033 7.033 0 0 0 2.05 8.953a6.655 6.655 0 0 0-1.517 2.162A6.393 6.393 0 0 0 0 13.667C0 14.403.597 15 1.333 15h11.334c.736 0 1.333-.597 1.333-1.333 0-.876-.181-1.743-.533-2.552a6.654 6.654 0 0 0-1.517-2.162 7.032 7.032 0 0 0-2.747-1.614ZM9.5 4a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm2.592 7.714c.247.57.384 1.175.405 1.786H1.503a4.897 4.897 0 0 1 .405-1.786 5.156 5.156 0 0 1 1.177-1.675 5.534 5.534 0 0 1 1.787-1.136A5.805 5.805 0 0 1 7 8.5c.732 0 1.456.137 2.128.403.673.265 1.28.652 1.787 1.136a5.156 5.156 0 0 1 1.177 1.675Z"
      />
    </svg>
  `;
}
