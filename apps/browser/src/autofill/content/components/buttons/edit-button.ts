import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { EventSecurity } from "../../../utils/event-security";
import { themes, spacing } from "../constants/styles";
import { PencilSquare } from "../icons";

const editButtonIconSize = "16px";
const editButtonInset = spacing["1"];
const editButtonSize = `calc(${editButtonIconSize} + (${editButtonInset} * 2))`;

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
        if (EventSecurity.isEventTrusted(event) && !disabled) {
          buttonAction(event);
        }
      }}
    >
      ${PencilSquare({ disabled, theme })}
    </button>
  `;
}

const editButtonStyles = ({ disabled, theme }: { disabled?: boolean; theme: Theme }) => css`
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${editButtonSize};
  height: ${editButtonSize};
  border: 1px solid transparent;
  border-radius: ${editButtonInset};
  background-color: transparent;
  padding: ${editButtonInset};

  ${!disabled
    ? `
    cursor: pointer;

    :hover {
      border-color: ${themes[theme].primary["600"]};
    }
  `
    : ""}

  > svg {
    width: ${editButtonIconSize};
    height: ${editButtonIconSize};
  }
`;
