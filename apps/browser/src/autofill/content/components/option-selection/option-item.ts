import createEmotion from "@emotion/css/create-instance";
import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { IconProps, Option } from "../common-types";
import { themes, spacing } from "../constants/styles";

export const optionItemTagName = "option-item";

const { css } = createEmotion({
  key: optionItemTagName,
});

export type OptionItemProps = Option & {
  theme: Theme;
  handleSelection: () => void;
};

export function OptionItem({ icon, text, value, theme, handleSelection }: OptionItemProps) {
  const handleSelectionKeyUpProxy = (event: KeyboardEvent) => {
    const listenedForKeys = new Set(["Enter", "Space"]);
    if (listenedForKeys.has(event.code) && event.target instanceof Element) {
      handleSelection();
    }

    return;
  };

  const iconProps: IconProps = { color: themes[theme].text.main, theme };
  const itemIcon = icon?.(iconProps);

  return html`<div
    class=${optionItemStyles}
    key=${value}
    tabindex="0"
    title=${text}
    @click=${handleSelection}
    @keyup=${handleSelectionKeyUpProxy}
  >
    ${itemIcon ? html`<div class=${optionItemIconContainerStyles}>${itemIcon}</div>` : nothing}
    <span class=${optionItemTextStyles}>${text || value}</span>
  </div>`;
}

export const optionItemIconWidth = 16;
const optionItemGap = spacing["2"];

const optionItemStyles = css`
  gap: ${optionItemGap};
  user-select: none;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-start;
  cursor: pointer;
`;

const optionItemIconContainerStyles = css`
  display: flex;
  flex-grow: 1;
  flex-shrink: 1;
  max-width: ${optionItemIconWidth}px;
  max-height: ${optionItemIconWidth}px;

  > svg {
    width: 100%;
    height: auto;
  }
`;

const optionItemTextStyles = css`
  flex: 1 1 calc(100% - ${optionItemIconWidth}px - ${optionItemGap});
  overflow-x: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
