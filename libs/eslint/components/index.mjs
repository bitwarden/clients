import requireLabelOnBiticonbutton from "./require-label-on-biticonbutton.mjs";
import requireThemeColorsInSvg from "./require-theme-colors-in-svg.mjs";
import noBwiClassUsage from "./no-bwi-class-usage.mjs";
import noIconChildrenInBitButton from "./no-icon-children-in-bit-button.mjs";

export default {
  rules: {
    "require-label-on-biticonbutton": requireLabelOnBiticonbutton,
    "require-theme-colors-in-svg": requireThemeColorsInSvg,
    "no-bwi-class-usage": noBwiClassUsage,
    "no-icon-children-in-bit-button": noIconChildrenInBitButton,
  },
};
