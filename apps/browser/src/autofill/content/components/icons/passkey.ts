import { css } from "@emotion/css";
import { html } from "lit";

import { IconProps } from "../common-types";
import { buildIconColorRule, resolveIconColor, ruleNames } from "../constants/styles";

export function Passkey(props: IconProps) {
  const { ariaHidden = true } = props;
  const shapeColor = resolveIconColor(props);

  return html`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="${ariaHidden}"
    >
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M11 3c0 1.026-.514 1.93-1.3 2.472a6 6 0 0 1 .465.143 5.9 5.9 0 0 1 1.86 1.054c.455.385.836.836 1.125 1.335a.75.75 0 1 1-1.3.75 3.6 3.6 0 0 0-.793-.94 4.4 4.4 0 0 0-1.66-.87 5.1 5.1 0 0 0-3.065.086 4.4 4.4 0 0 0-1.389.784c-.33.28-.596.598-.793.94a.75.75 0 0 1-1.3-.75c.289-.5.67-.95 1.124-1.335a5.9 5.9 0 0 1 1.861-1.054 6 6 0 0 1 .465-.143A3 3 0 1 1 11 3M8 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M7.83 14a3.001 3.001 0 1 1 0-2h4.582a.25.25 0 0 1 .156.055l.972.777a.56.56 0 0 1 .046.832L12.41 14.84a.547.547 0 0 1-.824-.059L11 14h-.25l-.6.8a.5.5 0 0 1-.8 0l-.6-.8zM4.5 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2"
      />
    </svg>
  `;
}
