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
        300: rgba("--color-primary-300"),
        500: rgba("--color-primary-500"),
        700: rgba("--color-primary-700"),
      },
      secondary: {
        100: rgba("--color-secondary-100"),
        300: rgba("--color-secondary-300"),
        500: rgba("--color-secondary-500"),
        700: rgba("--color-secondary-700"),
      },
      success: {
        500: rgba("--color-success-500"),
        700: rgba("--color-success-700"),
      },
      danger: {
        500: rgba("--color-danger-500"),
        700: rgba("--color-danger-700"),
      },
      warning: {
        500: rgba("--color-warning-500"),
        700: rgba("--color-warning-700"),
      },
      info: {
        500: rgba("--color-info-500"),
        700: rgba("--color-info-700"),
      },
      text: {
        main: rgba("--color-text-main"),
        muted: rgba("--color-text-muted"),
        contrast: rgba("--color-text-contrast"),
        alt2: rgba("--color-text-alt2"),
        code: rgba("--color-text-code"),
      },
      background: {
        DEFAULT: rgba("--color-background"),
        alt: rgba("--color-background-alt"),
        alt2: rgba("--color-background-alt2"),
        alt3: rgba("--color-background-alt3"),
        alt4: rgba("--color-background-alt4"),
      },
    },
    textColor: {
      main: rgba("--color-text-main"),
      muted: rgba("--color-text-muted"),
      contrast: rgba("--color-text-contrast"),
      alt2: rgba("--color-text-alt2"),
      code: rgba("--color-text-code"),
      success: rgba("--color-success-500"),
      danger: rgba("--color-danger-500"),
      warning: rgba("--color-warning-500"),
      info: rgba("--color-info-500"),
      primary: {
        300: rgba("--color-primary-300"),
        500: rgba("--color-primary-500"),
        700: rgba("--color-primary-700"),
      },
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
