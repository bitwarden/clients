import { CHIP_SIZES, CHIP_VARIANTS } from "./chip-styles";

const icons = [
  "bwi-filter",
  "bwi-folder",
  "bwi-tag",
  "bwi-check",
  "bwi-check-circle",
  "bwi-user",
  "bwi-plus",
];

export const sharedArgTypes = {
  startIcon: {
    control: "select",
    options: icons,
    description: "Icon to display at the start of the chip",
  },
  disabled: { control: "boolean", description: "Disables the chip" },
} as const;

export const sizeArgType = {
  size: {
    options: CHIP_SIZES,
    control: { type: "select" },
    description: "Sets the size of the chip.",
    table: { type: { summary: CHIP_SIZES.join(" | ") }, defaultValue: { summary: "large" } },
  },
} as const;

export const fullWidthArgType = {
  fullWidth: { control: "boolean", description: "Whether the chip takes full width" },
} as const;

export const variantArgType = {
  variant: {
    options: CHIP_VARIANTS,
    control: { type: "select" },
    description: "Sets the visual variant of the chip.",
    table: { type: { summary: CHIP_VARIANTS.join(" | ") }, defaultValue: { summary: "primary" } },
  },
} as const;

export const themeModes = {
  chromatic: { modes: { light: { theme: "light" }, dark: { theme: "dark" } } },
} as const;
