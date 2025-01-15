import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { themes, typography, spacing } from "../constants/styles";
import { PencilSquare } from "../icons";

export function EditButton({
  buttonAction,
  buttonText,
  disabled = false,
  theme,
}: {
  buttonAction: (e: Event) => void;
  buttonText: string;
  disabled?: boolean;
  theme: Theme;
}) {
  return html`
    <button
      type="button"
      title=${buttonText}
      class=${editButtonStyles({ disabled, theme })}
      @click=${(event: Event) => {
        // FIXME: Remove when updating file. Eslint update
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        !disabled && buttonAction(event);
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
