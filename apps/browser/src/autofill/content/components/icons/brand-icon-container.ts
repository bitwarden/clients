import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { Shield } from "./shield";

export function BrandIconContainer({ iconLink, theme }: { iconLink?: URL; theme: Theme }) {
  const Icon = html`<div class=${brandIconContainerStyles}>${Shield({ theme })}</div>`;

  return iconLink ? html`<a href="${iconLink}" target="_blank" rel="noreferrer">${Icon}</a>` : Icon;
}

const brandIconContainerStyles = css`
  display: flex;
  justify-content: center;
  width: 24px;
  height: 24px;

  > svg {
    width: auto;
    height: 100%;
  }
`;
