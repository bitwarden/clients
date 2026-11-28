import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, nothing } from "lit";

import { ButtonTypes } from "./button-styles";
import "./button";

type Args = {
  buttonType: string;
  size: string;
  block: boolean;
  disabled: boolean;
  loading: boolean;
  startIcon?: string;
  endIcon?: string;
  label: string;
};

export default {
  title: "Component Library/Button",
  component: "bit-button",
  args: {
    buttonType: "primary",
    size: "default",
    block: false,
    disabled: false,
    loading: false,
    label: "Button",
  },
  argTypes: {
    buttonType: { control: "select", options: Object.values(ButtonTypes) },
    size: { control: "radio", options: ["small", "default", "large"] },
  },
  render: (args) => html`
    <bit-button
      button-type=${args.buttonType}
      size=${args.size}
      ?block=${args.block}
      ?disabled=${args.disabled}
      ?loading=${args.loading}
      start-icon=${args.startIcon ?? nothing}
      end-icon=${args.endIcon ?? nothing}
      >${args.label}</bit-button
    >
  `,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Primary: Story = {};

export const Secondary: Story = { args: { buttonType: "secondary" } };

export const Danger: Story = { args: { buttonType: "danger" } };

export const AllVariants: Story = {
  render: (args) => html`
    <div class="tw-flex tw-flex-wrap tw-gap-2">
      ${Object.values(ButtonTypes)
        .filter((type) => !type.startsWith("contrast") && type !== "side-nav")
        .map(
          (type) =>
            html`<bit-button button-type=${type} size=${args.size} ?disabled=${args.disabled}
              >${type}</bit-button
            >`,
        )}
    </div>
    <div class="tw-mt-4 tw-flex tw-flex-wrap tw-gap-2 tw-bg-bg-contrast tw-p-4">
      ${Object.values(ButtonTypes)
        .filter((type) => type.startsWith("contrast"))
        .map(
          (type) => html`<bit-button button-type=${type} size=${args.size}>${type}</bit-button>`,
        )}
    </div>
  `,
};

export const Sizes: Story = {
  render: () => html`
    <div class="tw-flex tw-items-center tw-gap-2">
      <bit-button button-type="primary" size="small">Small</bit-button>
      <bit-button button-type="primary">Default</bit-button>
      <bit-button button-type="primary" size="large">Large</bit-button>
    </div>
  `,
};

export const WithIcons: Story = {
  args: { startIcon: "bwi-plus", endIcon: "bwi-angle-right" },
};

export const Disabled: Story = { args: { disabled: true } };

export const Loading: Story = { args: { loading: true } };

export const Block: Story = { args: { block: true } };

export const AsLink: Story = {
  render: () =>
    html`<bit-button button-type="primary" href="#" start-icon="bwi-external-link"
      >Link styled as button</bit-button
    >`,
};

export const AsyncAction: Story = {
  render: () => html`
    <bit-button
      button-type="primary"
      .action=${() => new Promise((resolve) => setTimeout(resolve, 2000))}
      >Save (2s)</bit-button
    >
  `,
};

export const InForm: Story = {
  render: () => html`
    <form
      class="tw-flex tw-flex-col tw-gap-2"
      @submit=${(event: SubmitEvent) => {
        event.preventDefault();
        const output = (event.target as HTMLFormElement).querySelector("output");
        if (output) {
          output.textContent = `Submitted: ${JSON.stringify(Object.fromEntries(new FormData(event.target as HTMLFormElement, event.submitter)))}`;
        }
      }}
    >
      <input
        name="email"
        type="email"
        required
        placeholder="Required email"
        class="tw-border tw-p-2"
      />
      <div class="tw-flex tw-gap-2">
        <bit-button button-type="primary" type="submit" name="intent" value="save"
          >Submit</bit-button
        >
        <bit-button type="reset">Reset</bit-button>
      </div>
      <output class="tw-text-sm"></output>
    </form>
  `,
};
