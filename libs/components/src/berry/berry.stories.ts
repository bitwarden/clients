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
    variant: "primary",
    count: undefined,
  },
  argTypes: {
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
    count: {
      control: "number",
      description: "Optional count to display. Maximum displayed is 999, values above show '999+'",
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
    template: `<bit-berry [variant]="variant" [count]="count"></bit-berry>`,
  }),
};

export const sizing: Story = {
  render: (args) => ({
    props: args,
    template: `
        <div class="tw-flex tw-items-center tw-gap-4">
            <bit-berry></bit-berry>
            <bit-berry [count]="5"></bit-berry>
            <bit-berry [count]="50"></bit-berry>
            <bit-berry [count]="500"></bit-berry>
            <bit-berry [count]="5000"></bit-berry>
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
            <bit-berry variant="primary"></bit-berry>
            <bit-berry variant="primary" [count]="5"></bit-berry>
            <bit-berry variant="primary" [count]="50"></bit-berry>
            <bit-berry variant="primary" [count]="500"></bit-berry>
            <bit-berry variant="primary" [count]="5000"></bit-berry>
        </div>

        <div class="tw-flex tw-items-center tw-gap-4">
            <span class="tw-w-20">Subtle:</span>
            <bit-berry variant="subtle"></bit-berry>
            <bit-berry variant="subtle" [count]="5"></bit-berry>
            <bit-berry variant="subtle" [count]="50"></bit-berry>
            <bit-berry variant="subtle" [count]="500"></bit-berry>
            <bit-berry variant="subtle" [count]="5000"></bit-berry>
        </div>

        <div class="tw-flex tw-items-center tw-gap-4">
            <span class="tw-w-20">Success:</span>
            <bit-berry variant="success"></bit-berry>
            <bit-berry variant="success" [count]="5"></bit-berry>
            <bit-berry variant="success" [count]="50"></bit-berry>
            <bit-berry variant="success" [count]="500"></bit-berry>
            <bit-berry variant="success" [count]="5000"></bit-berry>
        </div>

        <div class="tw-flex tw-items-center tw-gap-4">
            <span class="tw-w-20">Warning:</span>
            <bit-berry variant="warning"></bit-berry>
            <bit-berry variant="warning" [count]="5"></bit-berry>
            <bit-berry variant="warning" [count]="50"></bit-berry>
            <bit-berry variant="warning" [count]="500"></bit-berry>
            <bit-berry variant="warning" [count]="5000"></bit-berry>
        </div>

        <div class="tw-flex tw-items-center tw-gap-4">
            <span class="tw-w-20">Danger:</span>
            <bit-berry variant="danger"></bit-berry>
            <bit-berry variant="danger" [count]="5"></bit-berry>
            <bit-berry variant="danger" [count]="50"></bit-berry>
            <bit-berry variant="danger" [count]="500"></bit-berry>
            <bit-berry variant="danger" [count]="5000"></bit-berry>
        </div>

        <div class="tw-flex tw-items-center tw-gap-4">
            <span class="tw-w-20">Accent primary:</span>
            <bit-berry variant="accentPrimary"></bit-berry>
            <bit-berry variant="accentPrimary" [count]="5"></bit-berry>
            <bit-berry variant="accentPrimary" [count]="50"></bit-berry>
            <bit-berry variant="accentPrimary" [count]="500"></bit-berry>
            <bit-berry variant="accentPrimary" [count]="5000"></bit-berry>
        </div>

        <div class="tw-flex tw-items-center tw-gap-4 tw-bg-bg-dark">
            <span class="tw-w-20 tw-text-fg-white">Contrast:</span>
            <bit-berry variant="contrast"></bit-berry>
            <bit-berry variant="contrast" [count]="5"></bit-berry>
            <bit-berry variant="contrast" [count]="50"></bit-berry>
            <bit-berry variant="contrast" [count]="500"></bit-berry>
            <bit-berry variant="contrast" [count]="5000"></bit-berry>
        </div>
    </div>
    `,
  }),
};
