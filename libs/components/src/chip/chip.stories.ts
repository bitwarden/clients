import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { ChipComponent } from "./chip.component";

export default {
  title: "Component Library/Chip",
  component: ChipComponent,
  decorators: [
    moduleMetadata({
      imports: [ChipComponent],
    }),
  ],
  args: {
    selected: false,
    disabled: false,
    fullWidth: false,
    dismissible: false,
  },
} as Meta<ChipComponent>;

type Story = StoryObj<ChipComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <button bitChip
        [selected]="selected"
        [disabled]="disabled"
        [fullWidth]="fullWidth"
        [dismissible]="dismissible"
        [startIcon]="startIcon">
        Default Chip
      </button>
    `,
  }),
  args: {
    startIcon: "bwi-filter",
  },
};

export const WithIcon: Story = {
  render: (args) => ({
    props: args,
    template: `
      <button bitChip [startIcon]="startIcon">
        Status
      </button>
    `,
  }),
  args: {
    startIcon: "bwi-filter",
  },
};

export const Selected: Story = {
  render: (args) => ({
    props: args,
    template: `
      <button bitChip
        [selected]="selected"
        [startIcon]="startIcon">
        Selected
      </button>
    `,
  }),
  args: {
    startIcon: "bwi-check",
    selected: true,
  },
};

export const Disabled: Story = {
  render: (args) => ({
    props: args,
    template: `
      <button bitChip
        [disabled]="disabled"
        [startIcon]="startIcon">
        Disabled
      </button>
    `,
  }),
  args: {
    startIcon: "bwi-filter",
    disabled: true,
  },
};

export const Dismissible: Story = {
  render: (args) => ({
    props: args,
    template: `
      <span bitChip
        [dismissible]="dismissible"
        [startIcon]="startIcon"
        (dismissed)="onDismissed()">
        Tag Name
      </span>
    `,
  }),
  args: {
    startIcon: "bwi-tag",
    dismissible: true,
  },
};

export const DismissibleSelected: Story = {
  render: (args) => ({
    props: args,
    template: `
      <span bitChip
        [selected]="selected"
        [dismissible]="dismissible"
        [startIcon]="startIcon"
        (dismissed)="onDismissed()">
        Priority: High
      </span>
    `,
  }),
  args: {
    startIcon: "bwi-tag",
    selected: true,
    dismissible: true,
  },
};

export const FullWidth: Story = {
  render: (args) => ({
    props: args,
    template: `
      <button bitChip
        [fullWidth]="fullWidth"
        [startIcon]="startIcon">
        Full Width Chip
      </button>
    `,
  }),
  args: {
    startIcon: "bwi-filter",
    fullWidth: true,
  },
};

export const OnButton: Story = {
  render: (args) => ({
    props: args,
    template: `
      <button bitChip
        [startIcon]="startIcon"
        (chipClick)="onClick()">
        Click Me
      </button>
    `,
  }),
  args: {
    startIcon: "bwi-download",
  },
};

export const OnSpan: Story = {
  render: (args) => ({
    props: args,
    template: `
      <span bitChip [startIcon]="startIcon">
        Read Only
      </span>
    `,
  }),
  args: {
    startIcon: "bwi-info-circle",
  },
};

export const OnDiv: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div bitChip [startIcon]="startIcon">
        Custom Container
      </div>
    `,
  }),
  args: {
    startIcon: "bwi-folder",
  },
};

export const OnLink: Story = {
  render: (args) => ({
    props: args,
    template: `
      <a bitChip
        href="#"
        [startIcon]="startIcon">
        Link Chip
      </a>
    `,
  }),
  args: {
    startIcon: "bwi-external-link",
  },
};

export const CustomContent: Story = {
  render: () => ({
    template: `
      <span bitChip>
        <img chipStart
          src="https://via.placeholder.com/20"
          class="tw-w-5 tw-h-5 tw-rounded-full"
          alt="Avatar" />
        <span>Custom Content</span>
        <span chipEnd class="tw-text-xs tw-opacity-70">+3</span>
      </span>
    `,
  }),
};

export const WithStartSlot: Story = {
  render: (args) => ({
    props: args,
    template: `
      <span bitChip>
        <span chipStart class="tw-flex tw-items-center tw-justify-center tw-w-5 tw-h-5 tw-rounded-full tw-bg-primary-600 tw-text-white tw-text-xs">
          AB
        </span>
        Alice Brown
      </span>
    `,
  }),
};

export const WithEndSlot: Story = {
  render: (args) => ({
    props: args,
    template: `
      <button bitChip [startIcon]="startIcon">
        Dropdown
        <button chipEnd class="bwi bwi-angle-down"></button>
      </button>
    `,
  }),
  args: {
    startIcon: "bwi-filter",
  },
};

export const LongLabel: Story = {
  render: (args) => ({
    props: args,
    template: `
      <button bitChip [startIcon]="startIcon">
        This is a very long label that should truncate with ellipsis
      </button>
    `,
  }),
  args: {
    startIcon: "bwi-tag",
  },
};

export const MultipleChips: Story = {
  render: () => ({
    template: `
      <div class="tw-flex tw-flex-wrap tw-gap-2">
        <button bitChip startIcon="bwi-filter">Status</button>
        <span bitChip startIcon="bwi-tag" [selected]="true">Priority: High</span>
        <span bitChip startIcon="bwi-folder" [dismissible]="true">Project: Web</span>
        <button bitChip startIcon="bwi-download">Export</button>
        <span bitChip startIcon="bwi-user" [dismissible]="true">Assigned to Me</span>
      </div>
    `,
  }),
};

export const AllStates: Story = {
  render: () => ({
    template: `
      <div class="tw-space-y-4">
        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Default</h3>
          <button bitChip startIcon="bwi-filter">Default</button>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Selected</h3>
          <button bitChip startIcon="bwi-check" [selected]="true">Selected</button>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Disabled</h3>
          <button bitChip startIcon="bwi-filter" [disabled]="true">Disabled</button>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Dismissible</h3>
          <span bitChip startIcon="bwi-tag" [dismissible]="true">Dismissible</span>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Selected + Dismissible</h3>
          <span bitChip startIcon="bwi-tag" [selected]="true" [dismissible]="true">Selected Dismissible</span>
        </div>

        <div>
          <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Disabled + Dismissible</h3>
          <span bitChip startIcon="bwi-tag" [disabled]="true" [dismissible]="true">Disabled Dismissible</span>
        </div>
      </div>
    `,
  }),
};
