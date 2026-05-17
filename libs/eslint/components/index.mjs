import requireLabelOnBiticonbutton from "./require-label-on-biticonbutton.mjs";
import requireThemeColorsInSvg from "./require-theme-colors-in-svg.mjs";
import noBwiClassUsage from "./no-bwi-class-usage.mjs";
import noIconChildrenInBitButton from "./no-icon-children-in-bit-button.mjs";
import enforceReadonlyAngularProperties from "./enforce-readonly-angular-properties.mjs";

export default {
  rules: {
    "require-label-on-biticonbutton": requireLabelOnBiticonbutton,
    "require-theme-colors-in-svg": requireThemeColorsInSvg,
    "no-bwi-class-usage": noBwiClassUsage,
    "no-icon-children-in-bit-button": noIconChildrenInBitButton,
    "enforce-readonly-angular-properties": enforceReadonlyAngularProperties,
  },
};
