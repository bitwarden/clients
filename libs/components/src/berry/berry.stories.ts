import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { BerryComponent } from "./berry.component";

export default {
  title: "Component Library/Berry",
  component: BerryComponent,
  decorators: [
    moduleMetadata({
      imports: [BerryComponent],
    }),
  ],
  args: {
    type: "count",
    variant: "primary",
    value: 5,
  },
  argTypes: {
    type: {
      control: "select",
      options: ["status", "count"],
      description: "The type of the berry, which determines its size and content",
      table: {
        category: "Inputs",
        type: { summary: '"status" | "count"' },
        defaultValue: { summary: '"count"' },
      },
    },
    variant: {
      control: "select",
      options: ["primary", "subtle", "success", "warning", "danger", "accentPrimary", "contrast"],
      description: "The visual style variant of the berry",
      table: {
        category: "Inputs",
        type: { summary: "BerryVariant" },
        defaultValue: { summary: "primary" },
      },
    },
    value: {
      control: "number",
      description:
        "Optional value to display for berries with type 'count'. Maximum displayed is 999, values above show '999+'. If undefined, a small small berry is shown. If 0 or negative, the berry is hidden.",
      table: {
        category: "Inputs",
        type: { summary: "number | undefined" },
        defaultValue: { summary: "undefined" },
      },
    },
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/branch/rKUVGKb7Kw3d6YGoQl6Ho7/Tailwind-Component-Library?node-id=38367-199458&p=f&m=dev",
    },
  },
} as Meta<BerryComponent>;

type Story = StoryObj<BerryComponent>;

export const Primary: Story = {
  render: (args) => ({
    props: args,
    template: `<bit-berry [type]="type" [variant]="variant" [value]="value"></bit-berry>`,
  }),
};

export const statusType: Story = {
  render: (args) => ({
    props: args,
    template: `
        <div class="tw-flex tw-items-center tw-gap-4">
            <bit-berry [type]="'status'" variant="primary"></bit-berry>
            <bit-berry [type]="'status'" variant="subtle"></bit-berry>
            <bit-berry [type]="'status'" variant="success"></bit-berry>
            <bit-berry [type]="'status'" variant="warning"></bit-berry>
            <bit-berry [type]="'status'" variant="danger"></bit-berry>
            <bit-berry [type]="'status'" variant="accentPrimary"></bit-berry>
            <bit-berry [type]="'status'" variant="contrast"></bit-berry>
        </div>
    `,
  }),
};

export const countType: Story = {
  render: (args) => ({
    props: args,
    template: `
        <div class="tw-flex tw-items-center tw-gap-4">
            <bit-berry [value]="5"></bit-berry>
            <bit-berry [value]="50"></bit-berry>
            <bit-berry [value]="500"></bit-berry>
            <bit-berry [value]="5000"></bit-berry>
        </div>
    `,
  }),
};

export const AllVariants: Story = {
  render: () => ({
    template: `
    <div class="tw-flex tw-flex-col tw-gap-4">
        <div class="tw-flex tw-items-center tw-gap-4">
            <span class="tw-w-20">Primary:</span>
            <bit-berry type="status" variant="primary"></bit-berry>
            <bit-berry variant="primary" [value]="5"></bit-berry>
            <bit-berry variant="primary" [value]="50"></bit-berry>
            <bit-berry variant="primary" [value]="500"></bit-berry>
            <bit-berry variant="primary" [value]="5000"></bit-berry>
        </div>

        <div class="tw-flex tw-items-center tw-gap-4">
            <span class="tw-w-20">Subtle:</span>
            <bit-berry type="status"variant="subtle"></bit-berry>
            <bit-berry variant="subtle" [value]="5"></bit-berry>
            <bit-berry variant="subtle" [value]="50"></bit-berry>
            <bit-berry variant="subtle" [value]="500"></bit-berry>
            <bit-berry variant="subtle" [value]="5000"></bit-berry>
        </div>

        <div class="tw-flex tw-items-center tw-gap-4">
            <span class="tw-w-20">Success:</span>
            <bit-berry type="status" variant="success"></bit-berry>
            <bit-berry variant="success" [value]="5"></bit-berry>
            <bit-berry variant="success" [value]="50"></bit-berry>
            <bit-berry variant="success" [value]="500"></bit-berry>
            <bit-berry variant="success" [value]="5000"></bit-berry>
        </div>

        <div class="tw-flex tw-items-center tw-gap-4">
            <span class="tw-w-20">Warning:</span>
            <bit-berry type="status" variant="warning"></bit-berry>
            <bit-berry variant="warning" [value]="5"></bit-berry>
            <bit-berry variant="warning" [value]="50"></bit-berry>
            <bit-berry variant="warning" [value]="500"></bit-berry>
            <bit-berry variant="warning" [value]="5000"></bit-berry>
        </div>

        <div class="tw-flex tw-items-center tw-gap-4">
            <span class="tw-w-20">Danger:</span>
            <bit-berry type="status" variant="danger"></bit-berry>
            <bit-berry variant="danger" [value]="5"></bit-berry>
            <bit-berry variant="danger" [value]="50"></bit-berry>
            <bit-berry variant="danger" [value]="500"></bit-berry>
            <bit-berry variant="danger" [value]="5000"></bit-berry>
        </div>

        <div class="tw-flex tw-items-center tw-gap-4">
            <span class="tw-w-20">Accent primary:</span>
            <bit-berry type="status" variant="accentPrimary"></bit-berry>
            <bit-berry variant="accentPrimary" [value]="5"></bit-berry>
            <bit-berry variant="accentPrimary" [value]="50"></bit-berry>
            <bit-berry variant="accentPrimary" [value]="500"></bit-berry>
            <bit-berry variant="accentPrimary" [value]="5000"></bit-berry>
        </div>

        <div class="tw-flex tw-items-center tw-gap-4 tw-bg-bg-dark">
            <span class="tw-w-20 tw-text-fg-white">Contrast:</span>
            <bit-berry type="status" variant="contrast"></bit-berry>
            <bit-berry variant="contrast" [value]="5"></bit-berry>
            <bit-berry variant="contrast" [value]="50"></bit-berry>
            <bit-berry variant="contrast" [value]="500"></bit-berry>
            <bit-berry variant="contrast" [value]="5000"></bit-berry>
        </div>
    </div>
    `,
  }),
};
