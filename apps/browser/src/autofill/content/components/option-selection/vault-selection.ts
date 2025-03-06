import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { Option } from "../common-types";

export function VaultSelection({
  options,
  theme = ThemeTypes.Light,
  handleSelectionUpdate,
}: {
  options: Option[];
  theme: Theme;
  handleSelectionUpdate?: (selectValue: any, selectId: string) => void;
}) {
  return html`<option-selection
    theme=${theme}
    .options=${options}
    .handleSelectionUpdate=${handleSelectionUpdate}
  ></option-selection>`;
}
