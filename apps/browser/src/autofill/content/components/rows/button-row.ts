import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { ActionButton } from "../../../content/components/buttons/action-button";
import { spacing } from "../../../content/components/constants/styles";
import { FolderSelection } from "../option-selection/folder-selection";
import { optionSelectionTagName, Option } from "../option-selection/option-selection";
import { VaultSelection } from "../option-selection/vault-selection";

export function ButtonRow({
  theme,
  primaryButtonText,
  handlePrimaryButtonClick = (event) => {},
  handleSelectionUpdate = () => {},
}: {
  theme: Theme;
  primaryButtonText: string;
  handlePrimaryButtonClick: (e: Event) => void;
  handleSelectionUpdate?: (selectValue: any, selectId: string) => void;
}) {
  // Placeholders for options data hydration
  const vaultOptions: Option[] = [];
  const folderOptions: Option[] = [];

  return html`
    <div class=${buttonRowStyles}>
      ${ActionButton({
        handleClick: handlePrimaryButtonClick,
        buttonText: primaryButtonText,
        theme,
      })}
      <div class=${optionSelectionsStyles}>
        ${vaultOptions.length > 1
          ? VaultSelection({
              theme,
              options: vaultOptions,
              handleSelectionUpdate,
            })
          : nothing}
        ${folderOptions.length > 1
          ? FolderSelection({
              theme,
              options: folderOptions,
              handleSelectionUpdate,
            })
          : nothing}
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
