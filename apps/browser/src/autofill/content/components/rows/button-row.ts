import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { ActionButton } from "../../../content/components/buttons/action-button";
import { spacing } from "../../../content/components/constants/styles";
import { Option } from "../common-types";
import { optionSelectionTagName } from "../option-selection/option-selection";

export type ButtonRowProps = {
  theme: Theme;
  primaryButton: {
    text: string;
    handlePrimaryButtonClick: (args: any) => void;
  };
  selectButtons?: {
    id: string;
    label?: string;
    options: Option[];
    handleSelectionUpdate?: (args: any) => void;
  }[];
};

export function ButtonRow({ theme, primaryButton, selectButtons }: ButtonRowProps) {
  return html`
    <div class=${buttonRowStyles}>
      ${ActionButton({
        handleClick: primaryButton.handlePrimaryButtonClick,
        buttonText: primaryButton.text,
        theme,
      })}
      <div class=${optionSelectionsStyles}>
        ${selectButtons?.map(
          ({ id, label, options, handleSelectionUpdate }) =>
            html`
              <option-selection
                key=${id}
                theme=${theme}
                .label=${label}
                .options=${options}
                .handleSelectionUpdate=${handleSelectionUpdate}
              ></option-selection>
            ` || nothing,
        )}
      </div>
    </div>
  `;
}

const buttonRowStyles = css`
  gap: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-height: 52px;
  white-space: nowrap;

  > button {
    max-width: min-content;
    flex: 1 1 50%;
  }

  > div {
    flex: 1 1 min-content;
  }
`;

const optionSelectionsStyles = css`
  gap: 8px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  overflow: hidden;

  > ${optionSelectionTagName} {
    min-width: calc(50% - ${spacing["1.5"]});
  }
`;
