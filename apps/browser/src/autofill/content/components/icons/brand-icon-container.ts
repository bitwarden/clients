import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { Shield } from "./shield";

export function BrandIconContainer({ iconLink, theme }: { iconLink?: URL; theme: Theme }) {
  const Icon = html`<div class=${brandIconContainerStyles}>${Shield({ theme })}</div>`;

  return iconLink ? html`<a href="${iconLink}" target="_blank" rel="noreferrer">${Icon}</a>` : Icon;
}

const brandIconContainerStyles = css`
  > svg {
    width: 20px;
    height: fit-content;
  }
`;
