import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { ActionButton } from "../../../content/components/buttons/action-button";
import { spacing, themes } from "../../../content/components/constants/styles";
import { User, Folder, Business, Family } from "../../../content/components/icons";
import { FolderSelection } from "../option-selection/folder-selection";
import { optionSelectionTagName } from "../option-selection/option-selection";
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
  const iconProps = { color: themes[theme].text.main, theme };
  const activeIconProps = { ...iconProps, color: themes[theme].text.contrast };

  const mockVaultOptions = [
    { icon: User(iconProps), activeIcon: User(activeIconProps), text: "My Vault", value: 1 },
    {
      icon: Business(iconProps),
      activeIcon: Business(activeIconProps),
      text: "Acme, inc",
      value: 2,
    },
    {
      icon: Business(iconProps),
      activeIcon: Business(activeIconProps),
      text: "A Really Long Business Name That Just Kinda Goes On For A Really Long Time",
      value: 2,
    },
    {
      icon: Family(iconProps),
      activeIcon: Family(activeIconProps),
      text: "Family Vault",
      value: 3,
    },
  ];

  const FolderIcon = Folder(iconProps);
  const ActiveFolderIcon = Folder(activeIconProps);
  const mockFolderOptions = [
    { icon: FolderIcon, activeIcon: ActiveFolderIcon, text: "Folder 1", value: 1 },
    { icon: FolderIcon, activeIcon: ActiveFolderIcon, text: "Folder 2", value: 2 },
    { icon: FolderIcon, activeIcon: ActiveFolderIcon, text: "Folder 3", value: 3 },
  ];

  return html`
    <div class=${buttonRowStyles}>
      ${ActionButton({
        handleClick: handlePrimaryButtonClick,
        buttonText: primaryButtonText,
        theme,
      })}
      <div class=${optionSelectionsStyles}>
        ${mockVaultOptions.length > 1
          ? VaultSelection({
              theme,
              options: mockVaultOptions,
              handleSelectionUpdate,
            })
          : nothing}
        ${mockFolderOptions.length > 1
          ? FolderSelection({
              theme,
              options: mockFolderOptions,
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
