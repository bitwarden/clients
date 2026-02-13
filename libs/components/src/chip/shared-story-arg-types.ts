import { ArgTypes } from "@storybook/angular";

import { BITWARDEN_ICONS } from "../shared/icon";

import { ChipSizes, ChipVariants } from "./base-chip.directive";

const sharedArgTypes = {
  size: {
    options: Object.values(ChipSizes),
    control: { type: "select" },
    description: "Sets the size of the chip.",
    table: {
      type: { summary: Object.values(ChipSizes).join(" | ") },
      defaultValue: { summary: ChipSizes.Large },
    },
  },
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
    options: Object.values(ChipVariants),
    control: { type: "select" },
    description: "Sets the visual variant of the chip.",
    table: {
      type: { summary: Object.values(ChipVariants).join(" | ") },
      defaultValue: { summary: ChipVariants.Primary },
    },
  },
} satisfies Partial<ArgTypes>;

export { sharedArgTypes, variantArgType, endIconArgType, fullWidthArgType };
