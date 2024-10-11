// @TODO investigate more direct ways of using the shared
// SCSS variables in `apps/browser/src/autofill/shared/styles/variables.scss`

const darkiconthemes = '"theme_dark", "theme_solarizedDark", "theme_nord"';
const fontfamilysansserif = '"Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif';
const fontsizebase = "14px";
const textcolor = "#212529";
const mutedtextcolor = "#6c747c";
const bordercolor = "#ced4dc";
const bordercolordark = "#ddd";
const borderradius = "3px";
const focusoutlinecolor = "#1252a3";
const mutedblue = "#5a6d91";
const brandprimary = "#175ddc";
const backgroundcolor = "#ffffff";
const backgroundoffsetcolor = "#f0f0f0";
const solarizedDarkBase0 = "#839496";
const solarizedDarkBase03 = "#002b36";
const solarizedDarkBase02 = "#073642";
const solarizedDarkBase01 = "#586e75";
const solarizedDarkBase2 = "#eee8d5";
const solarizedDarkCyan = "#2aa198";
const solarizedDarkGreen = "#859900";
const successcolorlight = "#017e45";
const successcolordark = "#8db89b";
const errorcolorlight = "#c83522";
const errorcolordark = "#ee9792";

export const themes = {
  light: {
    textColor: textcolor,
    mutedTextColor: mutedtextcolor,
    backgroundColor: backgroundcolor,
    backgroundOffsetColor: backgroundoffsetcolor,
    primaryColor: brandprimary,
    buttonPrimaryColor: brandprimary,
    textContrast: backgroundcolor,
    inputBorderColor: bordercolordark,
    inputBackgroundColor: "#ffffff",
    borderColor: bordercolor,
    focusOutlineColor: focusoutlinecolor,
    successColor: successcolorlight,
    errorColor: errorcolorlight,
    passkeysAuthenticating: mutedblue,
  },
  dark: {
    textColor: "#ffffff",
    mutedTextColor: "#bac0ce",
    backgroundColor: "#2f343d",
    backgroundOffsetColor: "#2f343d",
    buttonPrimaryColor: "#6f9df1",
    primaryColor: "#6f9df1",
    textContrast: "#2f343d",
    inputBorderColor: "#4c525f",
    inputBackgroundColor: "#2f343d",
    borderColor: "#4c525f",
    focusOutlineColor: focusoutlinecolor,
    successColor: successcolordark,
    errorColor: errorcolordark,
    passkeysAuthenticating: "#bac0ce",
  },
};
