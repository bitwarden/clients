import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { themes, typography, spacing } from "../../constants/styles";
import { PencilSquare } from "../icons";

export function EditButton({
  buttonAction,
  buttonText,
  theme,
}: {
  buttonAction: (e: Event) => void;
  buttonText: string;
  theme: Theme;
}) {
  return html`
    <button
      type="button"
      title=${buttonText}
      class=${editButtonStyles({ theme })}
      @click=${buttonAction}
    >
      ${PencilSquare({ theme })}
    </button>
  `;
}

const editButtonStyles = ({ theme }: { theme: Theme }) => css`
  ${typography.helperMedium}

  user-select: none;
  border: 0.5px solid transparent;
  border-radius: 0.5rem;
  background-color: transparent;
  cursor: pointer;
  padding: ${spacing["1"]} ${spacing["2"]};
  max-height: fit-content;
  overflow: hidden;

  :hover {
    border-color: ${themes[theme].primary["600"]};
  }

  > svg {
    width: 16px;
    height: fit-content;
  }
`;
