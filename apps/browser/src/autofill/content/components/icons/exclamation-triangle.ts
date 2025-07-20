import { css } from "@emotion/css";
import { html } from "lit";

import { IconProps } from "../common-types";
import { buildIconColorRule, ruleNames, themes } from "../constants/styles";

export function ExclamationTriangle({ ariaHidden = true, color, disabled, theme }: IconProps) {
  const shapeColor = disabled ? themes[theme].secondary["300"] : color || themes[theme].text.main;

  return html`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 15"
      fill="none"
      aria-hidden="${ariaHidden}"
    >
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        d="M9 11C9 11.5523 8.55229 12 8 12C7.44772 12 7 11.5523 7 11C7 10.4477 7.44772 10 8 10C8.55229 10 9 10.4477 9 11Z"
      />
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        d="M7.31639 5C7.01564 5 6.78295 5.26359 6.82025 5.56202L7.19525 8.56202C7.22653 8.81223 7.43923 9 7.69139 9H8.30861C8.56077 9 8.77347 8.81223 8.80475 8.56202L9.17975 5.56202C9.21705 5.26359 8.98436 5 8.68361 5H7.31639Z"
      />
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M9.37384 1.01584C8.76324 -0.04174 7.23675 -0.041739 6.62616 1.01584L0.2149 12.1205C-0.395695 13.1781 0.36755 14.5 1.58874 14.5H14.4113C15.6325 14.5 16.3957 13.1781 15.7851 12.1205L9.37384 1.01584ZM14.4861 12.8705L8.0748 1.76584C8.06066 1.74135 8.05029 1.7355 8.04562 1.73291C8.03694 1.7281 8.02122 1.72266 8 1.72266C7.97878 1.72266 7.96305 1.7281 7.95438 1.73291C7.94971 1.7355 7.93934 1.74135 7.9252 1.76584L1.51394 12.8705C1.4998 12.895 1.49992 12.9069 1.50001 12.9122C1.50018 12.9221 1.50333 12.9385 1.51394 12.9568C1.52455 12.9752 1.53713 12.9861 1.54563 12.9912C1.55021 12.994 1.56046 13 1.58874 13H14.4113C14.4395 13 14.4498 12.994 14.4544 12.9912C14.4629 12.9861 14.4754 12.9752 14.4861 12.9568C14.4967 12.9385 14.4998 12.9221 14.5 12.9122C14.5001 12.9069 14.5002 12.895 14.4861 12.8705Z"
      />
    </svg>
  `;
}
