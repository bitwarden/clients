import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { ChipActionComponent } from "./chip-action.component";

export default {
  title: "Component Library/Chip Action",
  component: ChipActionComponent,
  decorators: [
    moduleMetadata({
      imports: [ChipActionComponent],
    }),
  ],
  args: {
    disabled: false,
    dismissible: false,
  },
} as Meta<ChipActionComponent>;

type Story = StoryObj<ChipActionComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <button 
        bitChipAction
        [disabled]="disabled"
        [dismissible]="dismissible"
      >
        Default Chip
      </button>
    `,
  }),
  args: {
    startIcon: "bwi-filter",
  },
};

export const WithStartIcon: Story = {
  render: (args) => ({
    props: args,
    template: `
      <button bitChipAction [startIcon]="startIcon">
        Status
      </button>
    `,
  }),
  args: {
    startIcon: "bwi-check-circle",
  },
};

export const WithEndIcon: Story = {
  render: (args) => ({
    props: args,
    template: `
      <button bitChipAction [endIcon]="endIcon">
        Status
      </button>
    `,
  }),
  args: {
    endIcon: "bwi-check-circle",
  },
};

export const Inactive: Story = {
  render: (args) => ({
    props: args,
    template: `
      <button bitChipAction
        [disabled]="disabled"
        [startIcon]="startIcon">
        Inactive Chip
      </button>
    `,
  }),
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
          <button bitChipAction variant="primary" startIcon="bwi-check">Default</button>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Subtle</h3>
          <button bitChipAction variant="subtle" startIcon="bwi-folder">Default</button>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Accent Primary</h3>
          <button bitChipAction variant="accent-primary" startIcon="bwi-info-circle">Default</button>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Accent Secondary</h3>
          <button bitChipAction variant="accent-secondary" startIcon="bwi-exclamation-triangle">Default</button>
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
            <button bitChipAction size="small" variant="primary" startIcon="bwi-tag">Primary</button>
            <button bitChipAction size="small" variant="subtle" startIcon="bwi-tag">Subtle</button>
            <button bitChipAction size="small" variant="accent-primary" startIcon="bwi-tag">Accent Primary</button>
            <button bitChipAction size="small" variant="accent-secondary" startIcon="bwi-tag">Accent Secondary</button>
          </div>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Large</h3>
          <div class="tw-flex tw-flex-wrap tw-gap-2 tw-items-center">
            <button bitChipAction size="large" variant="primary" startIcon="bwi-tag">Primary</button>
            <button bitChipAction size="large" variant="subtle" startIcon="bwi-tag">Subtle</button>
            <button bitChipAction size="large" variant="accent-primary" startIcon="bwi-tag">Accent Primary</button>
            <button bitChipAction size="large" variant="accent-secondary" startIcon="bwi-tag">Accent Secondary</button>
          </div>
        </div>
      </div>
    `,
  }),
};
