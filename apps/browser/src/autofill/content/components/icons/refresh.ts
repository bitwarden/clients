import { css } from "@emotion/css";
import { html } from "lit";

import { IconProps } from "../common-types";
import { buildIconColorRule, resolveIconColor, ruleNames } from "../constants/styles";

export function Refresh(props: IconProps) {
  const { ariaHidden = true } = props;
  const shapeColor = resolveIconColor(props);

  return html`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="${ariaHidden}"
    >
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M3.052 10.777a.75.75 0 0 0 1.49.162c.393-3.61 3.514-6.443 7.329-6.443 2.737 0 5.12 1.46 6.39 3.62h-1.993a.75.75 0 0 0 0 1.5h3.981a.75.75 0 0 0 .75-.75V4.883a.75.75 0 1 0-1.5 0v2.38a8.897 8.897 0 0 0-7.628-4.267c-4.566 0-8.343 3.395-8.82 7.78Zm17.89 2.44a.75.75 0 0 0-1.49-.162c-.393 3.61-3.514 6.442-7.329 6.442a7.396 7.396 0 0 1-6.39-3.62h1.996a.75.75 0 0 0 0-1.5H3.747a.75.75 0 0 0-.75.75v3.983a.75.75 0 0 0 1.5 0v-2.376a8.897 8.897 0 0 0 7.626 4.263c4.566 0 8.343-3.395 8.82-7.78Zm-8.19-3.78a.75.75 0 0 0-1.5 0v1.594l-1.497-.49a.75.75 0 0 0-.467 1.425l1.51.494-.942 1.32a.75.75 0 1 0 1.22.871l.925-1.295.925 1.295a.75.75 0 1 0 1.22-.871l-.941-1.32 1.51-.494a.75.75 0 1 0-.467-1.426l-1.497.49V9.438Z"
      />
    </svg>
  `;
}
