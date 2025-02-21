import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { buildIconColorRule, ruleNames, themes } from "../constants/styles";

export function PencilSquare({
  color,
  disabled,
  theme,
}: {
  color?: string;
  disabled?: boolean;
  theme: Theme;
}) {
  const shapeColor = disabled ? themes[theme].secondary["300"] : color || themes[theme].text.main;

  return html`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        d="M17.799 24H2.709a2.422 2.422 0 0 1-1.729-.735 2.533 2.533 0 0 1-.715-1.768V6.03c0-.663.257-1.299.715-1.769a2.416 2.416 0 0 1 1.728-.734h7.996c.216 0 .424.088.577.244a.846.846 0 0 1 0 1.18.808.808 0 0 1-.577.245H2.708a.809.809 0 0 0-.576.244.844.844 0 0 0-.238.59v15.467c0 .221.085.433.238.59.153.156.36.244.576.244h15.09a.809.809 0 0 0 .577-.244.843.843 0 0 0 .238-.59v-6.754a.832.832 0 0 1 .494-.801.796.796 0 0 1 .64 0 .82.82 0 0 1 .442.472.836.836 0 0 1 .052.33v6.753a2.53 2.53 0 0 1-.715 1.768c-.458.47-1.08.734-1.727.735ZM9.24 15.417a.812.812 0 0 1-.677-.373.852.852 0 0 1-.074-.783l1.32-3.239c.121-.297.297-.567.52-.795L19.615.714A2.394 2.394 0 0 1 21.325 0c.638.002 1.25.263 1.703.726.452.463.706 1.09.707 1.744a2.502 2.502 0 0 1-.7 1.746l-9.229 9.455c-.274.28-.609.489-.977.61l-3.34 1.09a.801.801 0 0 1-.248.047Zm12.084-13.76a.771.771 0 0 0-.558.235l-9.282 9.514a.828.828 0 0 0-.17.26l-.642 1.572 1.663-.543a.778.778 0 0 0 .317-.198l9.231-9.455a.812.812 0 0 0 .172-.88.805.805 0 0 0-.29-.363.78.78 0 0 0-.44-.136v-.006h-.001Z"
      />
    </svg>
  `;
}
