import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "./progress-bar";

type Args = { variant: string; value: number; accessibleName?: string; hideStartHint: boolean };

export default {
  title: "Component Library/Progress/Progress Bar",
  component: "bit-progress-bar",
  args: { variant: "primary", value: 50, accessibleName: "Upload progress", hideStartHint: false },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "subtle", "success", "warning", "danger"],
    },
    value: { control: { type: "range", min: 0, max: 100 } },
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-40933&t=b5tDKylm5sWm2yKo-4",
    },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Base: Story = {
  render: (args) => html`
    <div class="tw-w-[552px]">
      <bit-progress-bar
        variant=${args.variant}
        value=${args.value}
        .accessibleName=${args.accessibleName}
        ?hide-start-hint=${args.hideStartHint}
      ></bit-progress-bar>
    </div>
  `,
};

export const AllVariants: Story = {
  render: () => html`
    <div class="tw-flex tw-flex-col tw-w-[552px] tw-gap-4">
      ${["primary", "subtle", "success", "warning", "danger"].map(
        (variant, i) => html`
          <bit-progress-bar variant=${variant} value=${(i + 1) * 20} hide-start-hint>
            <span slot="label">${variant}</span>
          </bit-progress-bar>
        `,
      )}
    </div>
  `,
};

export const WithLabelAndHelperHint: Story = {
  render: () => html`
    <div class="tw-w-[552px]">
      <bit-progress-bar value="50">
        <span slot="label">File name</span>
        <span slot="start">50% complete</span>
        <span slot="end">50MB</span>
      </bit-progress-bar>
    </div>
  `,
};

export const StartHint: Story = {
  render: () => html`
    <div class="tw-w-[552px] tw-mb-8">
      <bit-progress-bar value="10"><span slot="label">Default</span></bit-progress-bar>
    </div>
    <div class="tw-w-[552px] tw-mb-8">
      <bit-progress-bar value="10" hide-start-hint>
        <span slot="label">Without Start Hint</span>
      </bit-progress-bar>
    </div>
    <div class="tw-flex tw-flex-col tw-w-[552px] tw-gap-4">
      ${[
        ["danger", 25, "Weak"],
        ["warning", 50, "Weak2"],
        ["primary", 75, "Good"],
        ["success", 100, "Strong"],
      ].map(
        ([variant, value, hint]) => html`
          <bit-progress-bar variant=${variant} value=${value}>
            <span slot="label">${variant}</span>
            <span slot="start">${hint}</span>
          </bit-progress-bar>
        `,
      )}
    </div>
  `,
};

export const WithAccessibleNameFallback: Story = {
  ...Base,
  args: { accessibleName: undefined },
};
