import requireLabelOnBiticonbutton from "./require-label-on-biticonbutton.mjs";
import requireThemeColorsInSvg from "./require-theme-colors-in-svg.mjs";

export default {
  meta: {
    name: "bitwarden-components",
  },
  rules: {
    "require-label-on-biticonbutton": requireLabelOnBiticonbutton,
    "require-theme-colors-in-svg": requireThemeColorsInSvg,
  },
};
