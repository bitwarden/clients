export type DecorativeVariant = "brand" | "teal" | "green" | "orange" | "red" | "purple" | "gray";

export type DecorativeEmphasis = "subtle" | "bold";

/** The background, border, and foreground colors for one decorative appearance. */
export type DecorativeColors = { background: string; border: string; text: string };

/** Resolves a decorative family and emphasis to its background/border/foreground CSS variables. */
export const decorativeColors = (
  family: DecorativeVariant,
  emphasis: DecorativeEmphasis,
): DecorativeColors => {
  const suffix = emphasis === "bold" ? "-bold" : "";
  return {
    background: `var(--color-bg-decorative-${family}${suffix})`,
    border: `var(--color-border-decorative-${family}${suffix})`,
    text: `var(--color-fg-decorative-${family}${suffix})`,
  };
};
