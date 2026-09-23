import { ArgTypes } from "@storybook/angular";

import { BITWARDEN_ICONS } from "../../shared/icon";

import { CHIP_SIZES, CHIP_VARIANTS } from "./base-chip.directive";

const sharedArgTypes = {
  startIcon: {
    control: "select",
    options: BITWARDEN_ICONS,
    description: "Icon to display at the start of the chip",
  },
  disabled: {
    control: "boolean",
    description: "Disables the chip",
  },
} satisfies Partial<ArgTypes>;

const sizeArgType = {
  size: {
    options: CHIP_SIZES,
    control: { type: "select" },
    description: "Sets the size of the chip.",
    table: {
      type: { summary: CHIP_SIZES.join(" | ") },
      defaultValue: { summary: "large" },
    },
  },
} satisfies Partial<ArgTypes>;

const endIconArgType = {
  endIcon: {
    control: "select",
    options: BITWARDEN_ICONS,
    description: "Icon to display at the end of the chip",
  },
} satisfies Partial<ArgTypes>;

const fullWidthArgType = {
  fullWidth: {
    control: "boolean",
    description: "Whether the chip takes full width",
  },
} satisfies Partial<ArgTypes>;

const variantArgType = {
  variant: {
    options: CHIP_VARIANTS,
    control: { type: "select" },
    description: "Sets the visual variant of the chip.",
    table: {
      type: { summary: CHIP_VARIANTS.join(" | ") },
      defaultValue: { summary: "primary" },
    },
  },
} satisfies Partial<ArgTypes>;

export { sizeArgType, sharedArgTypes, variantArgType, endIconArgType, fullWidthArgType };
