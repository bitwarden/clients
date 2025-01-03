import { css } from "@emotion/css";
import { html, TemplateResult } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { border, themes, typography, spacing } from "./constants/styles";
import { AngleDown } from "./icons";

export function DropdownMenu({
  buttonText,
  icon,
  disabled = false,
  selectAction,
  theme,
}: {
  selectAction?: (e: Event) => void;
  buttonText: string;
  icon?: TemplateResult;
  disabled?: boolean;
  theme: Theme;
}) {
  // @TODO placeholder/will not work; make stateful
  const showDropdown = false;
  const handleButtonClick = (event: Event) => {
    // if (!disabled) {
    //   // show dropdown
    //   showDropdown = !showDropdown;
    //   this.requestUpdate();
    // }
  };

  const dropdownMenuItems: TemplateResult[] = [];

  return html`
    <div class=${dropdownContainerStyles}>
      <button
        type="button"
        title=${buttonText}
        class=${dropdownButtonStyles({ disabled, theme })}
        @click=${handleButtonClick}
      >
        ${icon ?? null}
        <span class=${dropdownButtonTextStyles}>${buttonText}</span>
        ${AngleDown({ color: themes[theme].text.muted, theme })}
      </button>
      ${showDropdown
        ? html` <div class=${dropdownMenuStyles({ theme })}>${dropdownMenuItems}</div> `
        : null}
    </div>
  `;
}

const iconSize = "15px";

const dropdownContainerStyles = css`
  display: flex;

  > div,
  > button {
    width: 100%;
  }
`;

const dropdownButtonStyles = ({ disabled, theme }: { disabled: boolean; theme: Theme }) => css`
  ${typography.body2}

  font-weight: 400;
  gap: ${spacing["1.5"]};
  user-select: none;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  border-radius: ${border.radius.full};
  padding: ${spacing["1"]} ${spacing["2"]};
  max-height: fit-content;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;

  > svg {
    max-width: ${iconSize};
    height: fit-content;
  }

  ${disabled
    ? `
      border: 1px solid ${themes[theme].secondary["300"]};
      background-color: ${themes[theme].secondary["300"]};
      color: ${themes[theme].text.muted};
    `
    : `
      border: 1px solid ${themes[theme].text.muted};
      background-color: transparent;
      cursor: pointer;
      color: ${themes[theme].text.muted};

      :hover {
        border-color: ${themes[theme].secondary["700"]};
        background-color: ${themes[theme].secondary["100"]};
      }
    `}
`;

const dropdownButtonTextStyles = css`
  max-width: calc(100% - ${iconSize} - ${iconSize});
  overflow-x: hidden;
  text-overflow: ellipsis;
`;

const dropdownMenuStyles = ({ theme }: { theme: Theme }) => css`
  color: ${themes[theme].text.main};
  border: 1px solid ${themes[theme].secondary["500"]};
  border-radius: 0.5rem;
  background-clip: padding-box;
  background-color: ${themes[theme].background.DEFAULT};
  padding: 0.25rem 0.75rem;
  position: absolute;
  overflow-y: auto;
`;
