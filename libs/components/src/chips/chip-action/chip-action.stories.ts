import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { sharedArgTypes, variantArgType, sizeArgType } from "../shared/shared-story-arg-types";

import { ChipActionComponent } from "./chip-action.component";

export default {
  title: "Component Library/Chips/Chip Action",
  component: ChipActionComponent,
  decorators: [
    moduleMetadata({
      imports: [ChipActionComponent],
    }),
  ],
  args: {
    disabled: false,
    label: "Chip Label",
  },
  argTypes: {
    ...sharedArgTypes,
    ...variantArgType,
    ...sizeArgType,
  },
} as Meta;

type Story = StoryObj;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <button 
        bit-chip-action
        [disabled]="disabled"
        [startIcon]="startIcon"
        [label]="label"
        [variant]="variant"
        [size]="size"
      ></button>
    `,
  }),
};

export const WithStartIcon: Story = {
  ...Default,
  args: {
    startIcon: "bwi-check-circle",
  },
};

export const Inactive: Story = {
  ...Default,
  args: {
    startIcon: "bwi-filter",
    disabled: true,
  },
};

export const WithLongLabel: Story = {
  ...Default,
  args: {
    startIcon: "bwi-filter",
    label: "This is a chip action with a very long label that should truncate",
  },
};

export const AllVariants: Story = {
  render: () => ({
    template: `
      <div class="tw-space-y-4">
        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Primary</h3>
          <button bit-chip-action label="Primary" variant="primary" startIcon="bwi-check"></button>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Subtle</h3>
          <button bit-chip-action label="Subtle" variant="subtle" startIcon="bwi-folder"></button>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Accent Primary</h3>
          <button bit-chip-action label="Accent Primary" variant="accent-primary" startIcon="bwi-info"></button>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Accent Secondary</h3>
          <button bit-chip-action label="Accent Secondary" variant="accent-secondary" startIcon="bwi-warning"></button>
        </div>
      </div>
    `,
  }),
  parameters: {
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
};

export const AllSizes: Story = {
  render: () => ({
    template: `
      <div class="tw-space-y-4">
        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Small</h3>
          <div class="tw-flex tw-flex-wrap tw-gap-2 tw-items-center">
            <button bit-chip-action label="Small Primary" size="small" variant="primary" startIcon="bwi-tag"></button>
            <button bit-chip-action label="Small Subtle" size="small" variant="subtle" startIcon="bwi-tag"></button>
            <button bit-chip-action label="Small Accent Primary" size="small" variant="accent-primary" startIcon="bwi-tag"></button>
            <button bit-chip-action label="Small Accent Secondary" size="small" variant="accent-secondary" startIcon="bwi-tag"></button>
          </div>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Large</h3>
          <div class="tw-flex tw-flex-wrap tw-gap-2 tw-items-center">
            <button bit-chip-action label="Large Primary" size="large" variant="primary" startIcon="bwi-tag"></button>
            <button bit-chip-action label="Large Subtle" size="large" variant="subtle" startIcon="bwi-tag"></button>
            <button bit-chip-action label="Large Accent Primary" size="large" variant="accent-primary" startIcon="bwi-tag"></button>
            <button bit-chip-action label="Large Accent Secondary" size="large" variant="accent-secondary" startIcon="bwi-tag"></button>
          </div>
        </div>
      </div>
    `,
  }),
};
