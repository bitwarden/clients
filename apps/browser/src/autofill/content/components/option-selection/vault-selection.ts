import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { themes } from "../../../content/components/constants/styles";
import { User } from "../../../content/components/icons";
import { Option } from "../option-selection/option-selection";

export function VaultSelection({
  options,
  theme = ThemeTypes.Light,
  handleSelectionUpdate,
}: {
  options: Option[];
  theme: Theme;
  handleSelectionUpdate: (selectValue: any, selectId: string) => void;
}) {
  // @TODO localize
  const buttonText = "My vault";

  return html`<option-selection
    buttonText=${buttonText}
    theme=${theme}
    .icon=${User({ color: themes[theme].text.muted, theme })}
    .options=${options}
    .handleSelectionUpdate=${(selectValue: any) => handleSelectionUpdate(selectValue, "vault")}
  ></option-selection>`;
}
