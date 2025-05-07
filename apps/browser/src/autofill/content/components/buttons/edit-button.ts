import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { themes, typography, spacing } from "../constants/styles";
import { PencilSquare } from "../icons";

export type EditButtonProps = {
  buttonAction: (e: Event) => void;
  buttonText: string;
  disabled?: boolean;
  theme: Theme;
};

export function EditButton({ buttonAction, buttonText, disabled = false, theme }: EditButtonProps) {
  return html`
    <button
      type="button"
      title=${buttonText}
      aria-label=${buttonText}
      class=${editButtonStyles({ disabled, theme })}
      @click=${(event: Event) => {
        if (!disabled) {
          buttonAction(event);
        }
      }}
    >
      ${PencilSquare({ disabled, theme })}
    </button>
  `;
}

const editButtonStyles = ({ disabled, theme }: { disabled?: boolean; theme: Theme }) => css`
  ${typography.helperMedium}

  user-select: none;
  display: flex;
  border: 1px solid transparent;
  border-radius: ${spacing["1"]};
  background-color: transparent;
  padding: ${spacing["1"]};
  max-height: fit-content;
  overflow: hidden;

  ${!disabled
    ? `
    cursor: pointer;

    :hover {
      border-color: ${themes[theme].primary["600"]};
    }
  `
    : ""}

  > svg {
    width: 16px;
    height: fit-content;
  }
`;
