import { html, css } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { IconClose } from "./icon-close";

export function CloseButton({
  handleCloseNotification,
  theme,
}: {
  handleCloseNotification: (e: Event) => void;
  theme: Theme;
}) {
  return html`
    <div>
      <button type="button" style=${buttonStyles} @click=${handleCloseNotification}>
        ${IconClose({ theme })}
      </button>
    </div>
  `;
}

const buttonStyles = css`
  border: 1px solid transparent;
  border-radius: 8px;
  background-color: transparent;
  cursor: pointer;
`;
