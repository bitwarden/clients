import createEmotion from "@emotion/css/create-instance";
import { html, nothing } from "lit";

import { Option } from "./option-selection";

export const optionItemTagName = "option-item";

const { css } = createEmotion({
  key: optionItemTagName,
});

export function OptionItem({
  icon,
  text,
  value,
  handleSelection,
}: {
  icon?: Option["icon"];
  text: Option["text"];
  value: Option["value"];
  handleSelection: () => void;
}) {
  const handleSelectionKeyUpProxy = (event: KeyboardEvent) => {
    const listenedForKeys = new Set(["Enter", "Space"]);
    if (listenedForKeys.has(event.code) && event.target instanceof Element) {
      handleSelection();
    }

    return;
  };

  return html`<div
    class=${optionItemStyles}
    key=${value}
    tabindex="0"
    title=${text}
    @click=${handleSelection}
    @keyup=${handleSelectionKeyUpProxy}
  >
    ${icon ?? nothing}<span class=${optionItemTextStyles}>${text}</span>
  </div>`;
}

const optionItemStyles = css`
  gap: 6px;
  user-select: none;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-start;
  cursor: pointer;

  > svg {
    width: 1rem;
    height: fit-content;
  }
`;

const optionItemTextStyles = css`
  max-width: 260px;
  overflow-x: hidden;
  text-overflow: ellipsis;
`;
