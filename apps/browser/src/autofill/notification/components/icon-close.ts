import { html, css } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { themes } from "../constants/styles";

export function IconClose({ theme }: { theme: Theme }) {
  return html`
    <svg style=${iconStyles} xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none">
      <path
        style=${iconPathStyles(theme)}
        d="M14.431 13.57 8.865 8.173a.388.388 0 0 1 0-.559l5.498-5.33a.388.388 0 0 0-.005-.553.415.415 0 0 0-.572-.006l-5.498 5.33a.416.416 0 0 1-.577 0L2.196 1.72a.403.403 0 0 0-.29-.12.422.422 0 0 0-.292.115.395.395 0 0 0-.12.283.386.386 0 0 0 .125.28l5.515 5.338a.388.388 0 0 1 0 .559L1.56 13.568a.397.397 0 0 0-.12.28c0 .105.044.205.12.28a.416.416 0 0 0 .578-.001l5.574-5.395a.416.416 0 0 1 .577 0l5.567 5.395a.422.422 0 0 0 .582.005.398.398 0 0 0 .12-.282.387.387 0 0 0-.125-.281Z"
      />
    </svg>
  `;
}

const iconPathStyles = (theme: Theme) => css`
  fill: ${themes[theme].text.main};
`;

const iconStyles = css`
  display: block;
`;
