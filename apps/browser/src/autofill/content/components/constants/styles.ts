import { Theme } from "@bitwarden/common/platform/enums";

const lightTheme = {
  transparent: {
    hover: `rgb(0 0 0 / 0.02)`,
  },
  shadow: `rgba(168 179 200)`,
  primary: {
    100: `rgba(219, 229, 246)`,
    300: `rgba(121, 161, 233)`,
    600: `rgba(23, 93, 220)`,
    700: `rgba(26, 65, 172)`,
  },
  secondary: {
    100: `rgba(230, 233, 239)`,
    300: `rgba(168, 179, 200)`,
    500: `rgba(90, 109, 145)`,
    600: `rgba(83, 99, 131)`,
    700: `rgba(63, 75, 99)`,
  },
  success: {
    100: `rgba(219, 229, 246)`,
    600: `rgba(121, 161, 233)`,
    700: `rgba(26, 65, 172)`,
  },
  danger: {
    100: `rgba(255, 236, 239)`,
    600: `rgba(203, 38, 58)`,
    700: `rgba(149, 27, 42)`,
  },
  warning: {
    100: `rgba(255, 248, 228)`,
    600: `rgba(255, 191, 0)`,
    700: `rgba(172, 88, 0)`,
  },
  info: {
    100: `rgba(219, 229, 246)`,
    600: `rgba(121, 161, 233)`,
    700: `rgba(26, 65, 172)`,
  },
  art: {
    primary: `rgba(2, 15, 102)`,
    accent: `rgba(44, 221, 223)`,
  },
  text: {
    main: `rgba(27, 32, 41)`,
    muted: `rgba(90, 109, 145)`,
    contrast: `rgba(255, 255, 255)`,
    alt2: `rgba(255, 255, 255)`,
    code: `rgba(192, 17, 118)`,
  },
  background: {
    DEFAULT: `rgba(255, 255, 255)`,
    alt: `rgba(243, 246, 249)`,
    alt2: `rgba(23, 92, 219)`,
    alt3: `rgba(26, 65, 172)`,
    alt4: `rgba(2, 15, 102)`,
  },
  brandLogo: `rgba(23, 93, 220)`,
};

const darkTheme = {
  transparent: {
    hover: `rgb(255 255 255 / 0.02)`,
  },
  shadow: `rgba(0, 0, 0)`,
  primary: {
    100: `rgba(26, 39, 78)`,
    300: `rgba(26, 65, 172)`,
    600: `rgba(101, 171, 255)`,
    700: `rgba(170, 195, 239)`,
  },
  secondary: {
    100: `rgba(48, 57, 70)`,
    300: `rgba(82, 91, 106)`,
    500: `rgba(121, 128, 142)`,
    600: `rgba(143, 152, 166)`,
    700: `rgba(158, 167, 181)`,
  },
  success: {
    100: `rgba(11, 111, 21)`,
    600: `rgba(107, 241, 120)`,
    700: `rgba(191, 236, 195)`,
  },
  danger: {
    100: `rgba(149, 27, 42)`,
    600: `rgba(255, 78, 99)`,
    700: `rgba(255, 236, 239)`,
  },
  warning: {
    100: `rgba(172, 88, 0)`,
    600: `rgba(255, 191, 0)`,
    700: `rgba(255, 248, 228)`,
  },
  info: {
    100: `rgba(26, 65, 172)`,
    600: `rgba(121, 161, 233)`,
    700: `rgba(219, 229, 246)`,
  },
  art: {
    primary: `rgba(243, 246, 249)`,
    accent: `rgba(44, 221, 233)`,
  },
  text: {
    main: `rgba(243, 246, 249)`,
    muted: `rgba(136, 152, 181)`,
    contrast: `rgba(18 26 39)`,
    alt2: `rgba(255, 255, 255)`,
    code: `rgba(255, 143, 208)`,
  },
  background: {
    DEFAULT: `rgba(32, 39, 51)`,
    alt: `rgba(18, 26, 39)`,
    alt2: `rgba(47, 52, 61)`,
    alt3: `rgba(48, 57, 70)`,
    alt4: `rgba(18, 26, 39)`,
  },
  brandLogo: `rgba(255, 255, 255)`,
};

export const themes = {
  light: lightTheme,
  dark: darkTheme,

  // For compatibility
  system: lightTheme,
};

export const spacing = {
  4: `16px`,
  3: `12px`,
  2: `8px`,
  "1.5": `6px`,
  1: `4px`,
};

export const border = {
  radius: {
    large: `8px`,
    full: `9999px`,
  },
};

export const typography = {
  body1: `
    line-height: 24px;
    font-family: Inter, sans-serif;
    font-size: 16px;
  `,
  body2: `
    line-height: 20px;
    font-family: Inter, sans-serif;
    font-size: 14px;
  `,
  helperMedium: `
    line-height: 16px;
    font-family: Inter, sans-serif;
    font-size: 12px;
  `,
};

export const ruleNames = {
  fill: "fill",
  stroke: "stroke",
} as const;

type RuleName = (typeof ruleNames)[keyof typeof ruleNames];

/*
 * `color` is an intentionally generic name here, since either fill or stroke may apply, due to
 * inconsistent SVG construction. This consequently precludes dynamic multi-colored icons here.
 */
export const buildIconColorRule = (color: string, rule: RuleName = ruleNames.fill) => `
  ${rule}: ${color};
`;

export const animations = {
  spin: `
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(359deg);
    }
  `,
};

export function scrollbarStyles(theme: Theme, color?: { thumb?: string; track?: string }) {
  const thumbColor = color?.thumb || themes[theme].secondary["500"];
  const trackColor = color?.track || themes[theme].background.alt;

  return {
    /* FireFox & Chrome support */
    default: `
      scrollbar-color: ${thumbColor} ${trackColor};
    `,
    /* Safari Support */
    safari: `
      ::-webkit-scrollbar {
        overflow: auto;
      }
      ::-webkit-scrollbar-thumb {
        border-width: 4px;
        border-style: solid;
        border-radius: 0.5rem;
        border-color: transparent;
        background-clip: content-box;
        background-color: ${thumbColor};
      }
      ::-webkit-scrollbar-track {
        ${trackColor};
      }
      ::-webkit-scrollbar-thumb:hover {
        ${themes[theme].secondary["600"]};
      }
    `,
  };
}
