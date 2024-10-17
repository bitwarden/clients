/* eslint-disable */
const colors = require("tailwindcss/colors");
const plugin = require("tailwindcss/plugin");

function rgba(color) {
  return "rgb(var(" + color + ") / <alpha-value>)";
}

module.exports = {
  prefix: "tw-",
  content: [
    "./src/**/*.{html,ts}",
    "../../libs/components/src/**/*.{html,ts}",
    "../../libs/auth/src/**/*.{html,ts}",
  ],
  safelist: [],
  corePlugins: { preflight: false },
  theme: {
    colors: {
      transparent: {
        DEFAULT: colors.transparent,
        hover: "var(--color-transparent-hover)",
      },
      current: colors.current,
      black: colors.black,
      primary: {
        // Can only be used behind the extension refresh flag
        100: rgba("--color-primary-100"),
        300: rgba("--color-primary-300"),
        // Can only be used behind the extension refresh flag
        500: rgba("--color-primary-500"),
        600: rgba("--color-primary-600"),
        700: rgba("--color-primary-700"),
      },
      secondary: {
        100: rgba("--color-secondary-100"),
        300: rgba("--color-secondary-300"),
        600: rgba("--color-secondary-600"),
        700: rgba("--color-secondary-700"),
      },
      success: {
        600: rgba("--color-success-600"),
        700: rgba("--color-success-700"),
      },
      danger: {
        600: rgba("--color-danger-600"),
        700: rgba("--color-danger-700"),
      },
      warning: {
        600: rgba("--color-warning-600"),
        700: rgba("--color-warning-700"),
      },
      info: {
        600: rgba("--color-info-600"),
        700: rgba("--color-info-700"),
      },
      art: {
        primary: rgba("--color-art-primary"),
        accent: rgba("--color-art-accent"),
      },
      text: {
        main: rgba("--color-text-main"),
        muted: rgba("--color-text-muted"),
        contrast: rgba("--color-text-contrast"),
        alt2: rgba("--color-text-alt2"),
        code: rgba("--color-text-code"),
        headers: rgba("--color-text-headers"),
      },
      background: {
        DEFAULT: rgba("--color-background"),
        alt: rgba("--color-background-alt"),
        alt2: rgba("--color-background-alt2"),
        alt3: rgba("--color-background-alt3"),
        alt4: rgba("--color-background-alt4"),
      },
      "marketing-logo": rgba("--color-marketing-logo"),
    },
    textColor: {
      main: rgba("--color-text-main"),
      muted: rgba("--color-text-muted"),
      contrast: rgba("--color-text-contrast"),
      headers: rgba("--color-text-headers"),
      alt2: rgba("--color-text-alt2"),
      code: rgba("--color-text-code"),
      success: rgba("--color-success-600"),
      danger: rgba("--color-danger-600"),
      warning: rgba("--color-warning-600"),
      info: rgba("--color-info-600"),
      primary: {
        300: rgba("--color-primary-300"),
        600: rgba("--color-primary-600"),
        700: rgba("--color-primary-700"),
      },
    },
    fontFamily: {
      sans: [
        '"Open Sans"',
        '"Helvetica Neue"',
        "Helvetica",
        "Arial",
        "sans-serif",
        '"Apple Color Emoji"',
        '"Segoe UI Emoji"',
        '"Segoe UI Symbol"',
      ],
    },
    ringOffsetColor: ({ theme }) => ({
      DEFAULT: theme("colors.background"),
      ...theme("colors"),
    }),
    extend: {
      width: {
        "50vw": "50vw",
        "75vw": "75vw",
      },
      minWidth: {
        52: "13rem",
      },
      maxWidth: ({ theme }) => ({
        ...theme("width"),
        "90vw": "90vw",
      }),
    },
  },
  plugins: [
    plugin(function ({ matchUtilities, theme, addUtilities, addComponents, e, config }) {
      matchUtilities(
        {
          "mask-image": (value) => ({
            "-webkit-mask-image": value,
            "mask-image": value,
          }),
          "mask-position": (value) => ({
            "-webkit-mask-position": value,
            "mask-position": value,
          }),
          "mask-repeat": (value) => ({
            "-webkit-mask-repeat": value,
            "mask-repeat": value,
          }),
        },
        {},
      );
    }),
  ],
};
