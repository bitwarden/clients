import { html, nothing, TemplateResult } from "lit";

import "../../berry/berry";
import "../../icon/icon";
import type { BitwardenIcon } from "../../icon/shared-icon";

import { TAB_LABEL_CONTENT_CLASSES } from "./tab-styles";

export type TabLabelParts = {
  startIcon?: BitwardenIcon;
  endIcon?: BitwardenIcon;
  berryValue?: number;
};

export function renderTabLabel(
  parts: TabLabelParts,
  label: TemplateResult | string,
  end: TemplateResult | typeof nothing = nothing,
) {
  return html`<span class=${TAB_LABEL_CONTENT_CLASSES}>
    ${
      parts.startIcon
        ? html`<bit-icon name=${parts.startIcon} class="tw-text-base"></bit-icon>`
        : nothing
    }
    <span class="tw-min-w-0 tw-truncate">${label}</span>
    ${parts.berryValue ? html`<bit-berry .value=${parts.berryValue}></bit-berry>` : nothing}
    ${
      parts.endIcon
        ? html`<bit-icon name=${parts.endIcon} class="tw-text-base"></bit-icon>`
        : nothing
    }
    ${end}
  </span>`;
}
