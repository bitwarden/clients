import { css } from "lit";

// Note, the CSS string can be accessed by the `cssText` property
const lightTheme = {
  transparent: {
    hover: css`rgb(0 0 0 / 0.02)`,
  },
  shadow: css`rgba(168 179 200)`,
  primary: {
    100: css`rgba(219, 229, 246)`,
    300: css`rgba(121, 161, 233)`,
    600: css`rgba(23, 93, 220)`,
    700: css`rgba(26, 65, 172)`,
  },
  secondary: {
    100: css`rgba(230, 233, 239)`,
    300: css`rgba(168, 179, 200)`,
    500: css`rgba(90, 109, 145)`,
    600: css`rgba(83, 99, 131)`,
    700: css`rgba(63, 75, 99)`,
  },
  success: {
    100: css`rgba(219, 229, 246)`,
    600: css`rgba(121, 161, 233)`,
    700: css`rgba(26, 65, 172)`,
  },
  danger: {
    100: css`rgba(255, 236, 239)`,
    600: css`rgba(203, 38, 58)`,
    700: css`rgba(149, 27, 42)`,
  },
  warning: {
    100: css`rgba(255, 248, 228)`,
    600: css`rgba(255, 191, 0)`,
    700: css`rgba(172, 88, 0)`,
  },
  info: {
    100: css`rgba(219, 229, 246)`,
    600: css`rgba(121, 161, 233)`,
    700: css`rgba(26, 65, 172)`,
  },
  art: {
    primary: css`rgba(2, 15, 102)`,
    accent: css`rgba(44, 221, 223)`,
  },
  text: {
    main: css`rgba(27, 32, 41)`,
    muted: css`rgba(90, 109, 145)`,
    contrast: css`rgba(255, 255, 255)`,
    alt2: css`rgba(255, 255, 255)`,
    code: css`rgba(192, 17, 118)`,
  },
  background: {
    DEFAULT: css`rgba(255, 255, 255)`,
    alt: css`rgba(243, 246, 249)`,
    alt2: css`rgba(23, 92, 219)`,
    alt3: css`rgba(26, 65, 172)`,
    alt4: css`rgba(2, 15, 102)`,
  },
  brandLogo: css`rgba(23, 93, 220)`,
};

const darkTheme = {
  transparent: {
    hover: css`rgb(255 255 255 / 0.02)`,
  },
  shadow: css`rgba(0, 0, 0)`,
  primary: {
    100: css`rgba(2, 15, 102)`,
    300: css`rgba(26, 65, 172)`,
    600: css`rgba(101, 171, 255)`,
    700: css`rgba(170, 195, 239)`,
  },
  secondary: {
    100: css`rgba(48, 57, 70)`,
    300: css`rgba(82, 91, 106)`,
    500: css`rgba(121, 128, 142)`,
    600: css`rgba(143, 152, 166)`,
    700: css`rgba(158, 167, 181)`,
  },
  success: {
    100: css`rgba(11, 111, 21)`,
    600: css`rgba(107, 241, 120)`,
    700: css`rgba(191, 236, 195)`,
  },
  danger: {
    100: css`rgba(149, 27, 42)`,
    600: css`rgba(255, 78, 99)`,
    700: css`rgba(255, 236, 239)`,
  },
  warning: {
    100: css`rgba(172, 88, 0)`,
    600: css`rgba(255, 191, 0)`,
    700: css`rgba(255, 248, 228)`,
  },
  info: {
    100: css`rgba(26, 65, 172)`,
    600: css`rgba(121, 161, 233)`,
    700: css`rgba(219, 229, 246)`,
  },
  art: {
    primary: css`rgba(243, 246, 249)`,
    accent: css`rgba(44, 221, 233)`,
  },
  text: {
    main: css`rgba(243, 246, 249)`,
    muted: css`rgba(136, 152, 181)`,
    contrast: css`rgba(18 26 39)`,
    alt2: css`rgba(255, 255, 255)`,
    code: css`rgba(255, 143, 208)`,
  },
  background: {
    DEFAULT: css`rgba(32, 39, 51)`,
    alt: css`rgba(18, 26, 39)`,
    alt2: css`rgba(47, 52, 61)`,
    alt3: css`rgba(48, 57, 70)`,
    alt4: css`rgba(18, 26, 39)`,
  },
  brandLogo: css`rgba(255, 255, 255)`,
};

export const themes = {
  light: lightTheme,
  dark: darkTheme,

  // For compatibility
  system: lightTheme,
  nord: lightTheme,
  solarizedDark: darkTheme,
};

export const spacing = {
  4: css`16px`,
};

export const border = {
  radius: {
    large: css`8px`,
  },
};
