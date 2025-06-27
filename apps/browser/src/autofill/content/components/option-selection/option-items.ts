import createEmotion from "@emotion/css/create-instance";
import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { Option } from "../common-types";
import { themes, typography, scrollbarStyles, spacing } from "../constants/styles";

import { OptionItem, optionItemTagName } from "./option-item";

export const optionItemsTagName = "option-items";

const { css } = createEmotion({
  key: optionItemsTagName,
});

export type OptionItemsProps = {
  id: string;
  theme: Theme;
  topOffset: number;
  label?: string;
  options: Option[];
  handleOptionSelection: (selectedOption: Option) => void;
};

export function OptionItems({
  id,
  theme,
  topOffset,
  label,
  options,
  handleOptionSelection,
}: OptionItemsProps) {
  // @TODO get client vendor from context
  const isSafari = false;

  return html`
    <div
      class=${optionsStyles({ theme, topOffset })}
      key="container"
      @keyup=${(e: KeyboardEvent) => handleMenuKeyUp(e)}
    >
      ${label ? html`<div class=${optionsLabelStyles({ theme })}>${label}</div>` : nothing}
      <div class=${optionsWrapper({ isSafari, theme })}>
        ${options.map((option) =>
          OptionItem({
            id,
            ...option,
            theme,
            contextLabel: label,
            handleSelection: () => handleOptionSelection(option),
          }),
        )}
      </div>
    </div>
  `;
}

function handleMenuKeyUp(event: KeyboardEvent) {
  const items = [
    ...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[tabindex="0"]'),
  ];
  const index = items.indexOf(document.activeElement as HTMLElement);
  const direction = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;

  if (index === -1 || direction === 0) {
    return;
  }

  event.preventDefault();
  items[(index + direction + items.length) % items.length]?.focus();
}

const optionsStyles = ({ theme, topOffset }: { theme: Theme; topOffset: number }) => css`
  ${typography.body1}

  -webkit-font-smoothing: antialiased;
  position: absolute;
  /* top offset + line-height of dropdown button + top and bottom padding of button + border-width */
  top: calc(${topOffset}px + 20px + ${spacing["1"]} + ${spacing["1"]} + 1px);
  border: 1px solid ${themes[theme].secondary["500"]};
  border-radius: 0.5rem;
  background-clip: padding-box;
  background-color: ${themes[theme].background.DEFAULT};
  padding: 0.25rem 0;
  max-width: fit-content;
  overflow-y: hidden;
  color: ${themes[theme].text.main};
`;

const optionsLabelStyles = ({ theme }: { theme: Theme }) => css`
  ${typography.helperMedium}

  user-select: none;
  padding: 0.375rem ${spacing["3"]};
  color: ${themes[theme].text.muted};
  font-weight: 600;
`;

export const optionsMenuItemMaxWidth = 260;
export const optionsMenuItemsMaxHeight = 114;

const optionsWrapper = ({ isSafari, theme }: { isSafari: boolean; theme: Theme }) => css`
  max-height: ${optionsMenuItemsMaxHeight}px;
  overflow-y: auto;

  > [class*="${optionItemTagName}-"] {
    padding: ${spacing["1.5"]} ${spacing["3"]};
    max-width: ${optionsMenuItemMaxWidth}px;

    :hover {
      background-color: ${themes[theme].primary["100"]};
    }
  }

  ${isSafari
    ? scrollbarStyles(theme, { track: "transparent" }).safari
    : scrollbarStyles(theme, { track: "transparent" }).default}
`;
