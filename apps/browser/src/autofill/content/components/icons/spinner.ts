import { css, keyframes } from "@emotion/css";
import { html } from "lit";

import { IconProps } from "../common-types";
import { buildIconColorRule, ruleNames, themes, animations } from "../constants/styles";

export function Spinner({
  ariaHidden = true,
  color,
  disabled,
  theme,
  disableSpin = false,
}: IconProps & { disableSpin?: boolean }) {
  const shapeColor = disabled ? themes[theme].secondary["300"] : color || themes[theme].text.main;

  return html`
    <svg
      class=${disableSpin ? "" : animation}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="${ariaHidden}"
    >
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        d="M9.5 1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM14.5 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3ZM11.536 11.536a1.5 1.5 0 1 1 2.12 2.12 1.5 1.5 0 0 1-2.12-2.12ZM9.5 14.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM0 8a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0ZM4.464 13.657a1.5 1.5 0 1 1-2.12-2.121 1.5 1.5 0 0 1 2.12 2.12ZM2.343 2.343a1.5 1.5 0 1 1 2.121 2.121 1.5 1.5 0 0 1-2.12-2.12Z"
      />
    </svg>
  `;
}

const animation = css`
  animation: ${keyframes(animations.spin)} 2s infinite linear;
`;
