import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { buildIconColorRule, ruleNames, themes } from "../constants/styles";

export function Folder({
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
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 22" fill="none">
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        d="M21.78 3.823h-7.97a.823.823 0 0 1-.584-.265.872.872 0 0 1-.23-.61v-.396A2.321 2.321 0 0 0 12.348.93a2.214 2.214 0 0 0-1.577-.681H2.22A2.214 2.214 0 0 0 .645.93 2.321 2.321 0 0 0 0 2.552v16.88c-.003.608.23 1.191.647 1.624.417.432.984.677 1.576.681l19.554.016c.288 0 .574-.058.84-.171.267-.113.51-.278.714-.487a2.31 2.31 0 0 0 .497-.756c.115-.284.174-.588.172-.894V6.129c0-.606-.233-1.189-.648-1.62a2.223 2.223 0 0 0-1.572-.686ZM2.223 1.678h8.552c.22.006.43.101.582.265a.865.865 0 0 1 .23.61v.396c0 .606.234 1.189.65 1.62.416.432.983.677 1.576.684h7.97c.22.006.43.1.582.264a.86.86 0 0 1 .23.607v1.707a.56.56 0 0 1-.16.389.535.535 0 0 1-.38.159H1.951a.531.531 0 0 1-.381-.16.558.558 0 0 1-.16-.389V2.551a.867.867 0 0 1 .23-.609.82.82 0 0 1 .582-.265ZM22.34 20.08a.779.779 0 0 1-.558.238l-19.558-.014a.823.823 0 0 1-.582-.264.864.864 0 0 1-.23-.608v-9.065a.566.566 0 0 1 .16-.39.547.547 0 0 1 .38-.16h20.104c.143-.001.28.057.382.16a.561.561 0 0 1 .16.39v9.083a.903.903 0 0 1-.259.63h.001Z"
      />
    </svg>
  `;
}
