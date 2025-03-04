import { css } from "@emotion/css";
import { html, nothing, TemplateResult } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { border, spacing, themes, typography } from "../constants/styles";
import { AngleUp, AngleDown, Close } from "../icons";

export function OptionSelectionButton({
  icon,
  isActiveSelection,
  isDisabled,
  isOpen,
  text,
  theme,
  handleButtonClick,
  handleClearClick,
}: {
  icon?: TemplateResult;
  isActiveSelection: boolean;
  isDisabled: boolean;
  isOpen: boolean;
  text: string;
  theme: Theme;
  handleButtonClick: (e: Event) => void;
  handleClearClick: (e: Event) => void;
}) {
  const handleClearClickKeyUpProxy = (event: KeyboardEvent) => {
    event.preventDefault();

    const listenedForKeys = new Set(["Enter", "Space"]);
    if (listenedForKeys.has(event.code) && event.target instanceof Element) {
      handleClearClick(event);
    }

    return;
  };

  return html`
    <button
      class=${selectionButtonStyles({ isActiveSelection, isDisabled, theme })}
      title=${text}
      type="button"
      @click=${handleButtonClick}
    >
      ${icon ?? nothing}
      <span class=${dropdownButtonTextStyles}>${text}</span>
      ${isActiveSelection
        ? html`<span
            class=${closeIconStyles({ isActiveSelection, theme })}
            tabindex="0"
            @click=${handleClearClick}
            @keyup=${handleClearClickKeyUpProxy}
          >
            ${Close({ color: themes[theme].text.contrast, theme: theme })}
          </span> `
        : isOpen
          ? AngleUp({ color: themes[theme].text.muted, theme: theme })
          : AngleDown({ color: themes[theme].text.muted, theme: theme })}
    </button>
  `;
}

const iconSize = "15px";
const borderedIconPadding = "3px";

const selectionButtonStyles = ({
  isActiveSelection,
  isDisabled,
  theme,
}: {
  isActiveSelection: boolean;
  isDisabled: boolean;
  theme: Theme;
}) => css`
  ${typography.body2}

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
  font-weight: 400;

  ${isDisabled
    ? `
      border: 1px solid ${themes[theme].secondary["300"]};
      background-color: ${themes[theme].secondary["300"]};
      cursor: not-allowed;
      color: ${themes[theme].text.muted};
    `
    : `
      border: 1px solid ${themes[theme].text.muted};
      background-color: ${isActiveSelection ? themes[theme].text.muted : "transparent"};
      cursor: pointer;
      color: ${isActiveSelection ? themes[theme].text.contrast : themes[theme].text.muted};

      :hover {
        border-color: ${themes[theme].secondary["700"]};
        background-color: ${isActiveSelection ? themes[theme].secondary["700"] : themes[theme].secondary["100"]};
      }
    `}

  > svg {
    max-width: ${iconSize};
    height: fit-content;
  }
`;

const closeIconStyles = ({
  isActiveSelection,
  theme,
}: {
  isActiveSelection: boolean;
  theme: Theme;
}) => css`
  ${isActiveSelection
    ? `
      display: flex;
      border: 1px solid transparent;
      border-radius: 9999px;
      padding: ${borderedIconPadding};
      width: auto;
      height: calc(${iconSize} - ${borderedIconPadding});

      :hover {
        border-color: ${themes[theme].text.contrast};
      }
    `
    : ``}
`;

const dropdownButtonTextStyles = css`
  max-width: calc(100% - (${iconSize} * 2));
  overflow-x: hidden;
  text-overflow: ellipsis;
`;
