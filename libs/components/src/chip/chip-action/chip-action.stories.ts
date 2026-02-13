import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { sharedArgTypes, variantArgType, endIconArgType } from "../shared-story-arg-types";

import { ChipActionComponent } from "./chip-action.component";

export default {
  title: "Component Library/Chip/Chip Action",
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
    ...endIconArgType,
  },
} as Meta;

type Story = StoryObj;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <button 
        bitChipAction
        [disabled]="disabled"
        [startIcon]="startIcon"
        [endIcon]="endIcon"
        [label]="label"
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

export const WithEndIcon: Story = {
  ...Default,
  args: {
    endIcon: "bwi-check-circle",
  },
};

export const Inactive: Story = {
  ...Default,
  args: {
    startIcon: "bwi-filter",
    disabled: true,
  },
};

export const AllVariants: Story = {
  render: () => ({
    template: `
      <div class="tw-space-y-4">
        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Primary</h3>
          <button bitChipAction label="Primary" variant="primary" startIcon="bwi-check"></button>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Subtle</h3>
          <button bitChipAction label="Subtle" variant="subtle" startIcon="bwi-folder"></button>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Accent Primary</h3>
          <button bitChipAction label="Accent Primary" variant="accent-primary" startIcon="bwi-info-circle"></button>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Accent Secondary</h3>
          <button bitChipAction label="Accent Secondary" variant="accent-secondary" startIcon="bwi-exclamation-triangle"></button>
        </div>
      </div>
    `,
  }),
};

export const AllSizes: Story = {
  render: () => ({
    template: `
      <div class="tw-space-y-4">
        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Small</h3>
          <div class="tw-flex tw-flex-wrap tw-gap-2 tw-items-center">
            <button bitChipAction label="Small Primary" size="small" variant="primary" startIcon="bwi-tag"></button>
            <button bitChipAction label="Small Subtle" size="small" variant="subtle" startIcon="bwi-tag"></button>
            <button bitChipAction label="Small Accent Primary" size="small" variant="accent-primary" startIcon="bwi-tag"></button>
            <button bitChipAction label="Small Accent Secondary" size="small" variant="accent-secondary" startIcon="bwi-tag"></button>
          </div>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Large</h3>
          <div class="tw-flex tw-flex-wrap tw-gap-2 tw-items-center">
            <button bitChipAction label="Large Primary" size="large" variant="primary" startIcon="bwi-tag"></button>
            <button bitChipAction label="Large Subtle" size="large" variant="subtle" startIcon="bwi-tag"></button>
            <button bitChipAction label="Large Accent Primary" size="large" variant="accent-primary" startIcon="bwi-tag"></button>
            <button bitChipAction label="Large Accent Secondary" size="large" variant="accent-secondary" startIcon="bwi-tag"></button>
          </div>
        </div>
      </div>
    `,
  }),
};
