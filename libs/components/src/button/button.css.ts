// NOTE: Illustrative only — @vanilla-extract/recipes is not installed.
// Shows what the button styles would look like if migrated off Tailwind.

import { recipe, RecipeVariants } from "@vanilla-extract/recipes";

/**
 * Shared focus ring styles. Spread into each variant's `selectors` block.
 * Uses box-shadow to simulate ring + offset since `outline` doesn't support
 * border-radius in all browsers yet.
 */
const focusRing = {
  "&:focus-visible": {
    outline: "none",
    // ring-offset-2 (white gap) + ring-2 (primary color)
    boxShadow: "0 0 0 2px var(--color-background), 0 0 0 4px var(--color-primary-600)",
    zIndex: 10,
  },
};

export const buttonRecipe = recipe({
  base: {
    fontWeight: 500,
    borderRadius: "9999px",
    transition: "color 150ms cubic-bezier(0.4, 0, 0.2, 1), background-color 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1)",
    borderWidth: "2px",
    borderStyle: "solid",
    textAlign: "center",
    textDecoration: "none",
    cursor: "pointer",
    selectors: {
      "&:hover": { textDecoration: "none" },
      "&:focus": { outline: "none" },
    },
  },

  variants: {
    buttonType: {
      primary: {
        background: "var(--color-primary-600)",
        borderColor: "var(--color-primary-600)",
        color: "var(--color-contrast)",
        selectors: {
          "&:hover": {
            background: "var(--color-primary-700)",
            borderColor: "var(--color-primary-700)",
          },
          ...focusRing,
        },
      },
      secondary: {
        background: "transparent",
        borderColor: "var(--color-primary-600)",
        color: "var(--color-primary-600)",
        selectors: {
          "&:hover": { background: "var(--color-hover-default)" },
          ...focusRing,
        },
      },
      danger: {
        background: "transparent",
        borderColor: "var(--color-danger-600)",
        color: "var(--color-danger)",
        selectors: {
          "&:hover": {
            background: "var(--color-danger-600)",
            borderColor: "var(--color-danger-600)",
            color: "var(--color-contrast)",
          },
          ...focusRing,
        },
      },
      dangerPrimary: {
        background: "var(--color-danger-600)",
        borderColor: "var(--color-danger-600)",
        color: "var(--color-contrast)",
        selectors: {
          "&:hover": {
            background: "var(--color-danger-700)",
            borderColor: "var(--color-danger-700)",
          },
          ...focusRing,
        },
      },
      unstyled: {},
    },

    size: {
      default: { padding: "0.375rem 0.75rem" },
      small: { padding: "0.25rem 0.75rem", fontSize: "0.875rem" },
    },

    block: {
      full: { display: "block", width: "100%" },
      inline: { display: "inline-block" },
    },

    /**
     * Applied when the button is disabled or loading. Overrides the button
     * type's hover/background styles so the button appears inert.
     */
    showDisabledStyles: {
      shown: {
        selectors: {
          "&[aria-disabled='true']": {
            background: "var(--color-secondary-300) !important",
            borderColor: "var(--color-secondary-300)",
            color: "var(--color-muted) !important",
            cursor: "not-allowed",
          },
          "&:hover": {
            background: "var(--color-secondary-300)",
            borderColor: "var(--color-secondary-300)",
            color: "var(--color-muted) !important",
            textDecoration: "none",
          },
        },
      },
      hidden: {},
    },
  },

  defaultVariants: {
    buttonType: "secondary",
    size: "default",
    block: "inline",
    showDisabledStyles: "hidden",
  },
});

/**
 * Derive input types directly from the recipe so they never drift.
 * These replace the manually-maintained ButtonType / ButtonSize unions.
 */
export type ButtonRecipeVariants = NonNullable<RecipeVariants<typeof buttonRecipe>>;
export type ButtonType = ButtonRecipeVariants["buttonType"];
export type ButtonSize = ButtonRecipeVariants["size"];

/**
 * Layout styles for the button's internal elements.
 * These were previously inline Tailwind utilities in the template.
 */
import { style } from "@vanilla-extract/css";

export const buttonInner = {
  // Static — no variants, plain style() is correct here.
  wrapper: style({
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }),

  loadingOverlay: style({
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }),
};

/**
 * The content span has one variant: whether it's visible or hidden behind the
 * loading spinner. Recipe is the right primitive — same as buttonRecipe above.
 */
export const buttonContentRecipe = recipe({
  base: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  variants: {
    loading: {
      shown: { visibility: "hidden" },
      hidden: {},
    },
  },
  defaultVariants: {
    loading: "hidden",
  },
});
