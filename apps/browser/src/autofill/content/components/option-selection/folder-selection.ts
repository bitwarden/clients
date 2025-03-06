import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { Option } from "../common-types";
import { Folder } from "../icons";

export function FolderSelection({
  options,
  theme = ThemeTypes.Light,
  handleSelectionUpdate,
}: {
  options: Option[];
  theme: Theme;
  handleSelectionUpdate?: (selectValue: any, selectId: string) => void;
}) {
  const normalizedOptions = options.map(({ icon, ...other }) => ({ ...other, icon: Folder }));

  return html`<option-selection
    theme=${theme}
    .options=${normalizedOptions}
    .handleSelectionUpdate=${handleSelectionUpdate}
  ></option-selection>`;
}
