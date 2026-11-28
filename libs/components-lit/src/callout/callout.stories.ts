import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../button/button";
import "../link/link";
import "./callout";

type Args = { type: string; heading?: string; icon?: string };

const calloutTitle = "Callout Title";
const calloutContent =
  "Great job! You've read some important information regarding your current action.";

export default {
  title: "Component Library/Callout",
  component: "bit-callout",
  args: { heading: calloutTitle, type: "info" },
  argTypes: {
    type: { control: "select", options: ["info", "success", "warning", "danger", "subtle"] },
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-28300&t=b5tDKylm5sWm2yKo-4",
    },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Base: Story = {
  render: (args) => html`
    <bit-callout type=${args.type} .icon=${args.icon} .heading=${args.heading}
      >${calloutContent}</bit-callout
    >
  `,
};

export const AllVariants: Story = {
  render: () => html`
    <div class="tw-flex tw-flex-col tw-gap-4">
      ${["info", "success", "warning", "danger", "subtle"].map(
        (type) =>
          html`<bit-callout type=${type} heading=${type[0].toUpperCase() + type.slice(1)}
            >${calloutContent}</bit-callout
          >`,
      )}
    </div>
  `,
};

export const CustomIcon: Story = {
  render: () =>
    html`<bit-callout heading=${calloutTitle} icon="bwi-star">${calloutContent}</bit-callout>`,
};

export const NoTitle: Story = {
  render: () =>
    html`<bit-callout heading="" accessible-name="Success callout">${calloutContent}</bit-callout>`,
};

export const WithAccessibleNameFallback: Story = {
  render: () => html`
    <div class="tw-flex tw-flex-col tw-gap-4">
      <bit-callout type="info">${calloutContent}</bit-callout>
      <bit-callout type="success">${calloutContent}</bit-callout>
    </div>
  `,
};

export const NoIcon: Story = {
  render: () => html`<bit-callout heading=${calloutTitle} icon="">${calloutContent}</bit-callout>`,
};

export const WithInlineLink: Story = {
  render: () => html`
    <bit-callout accessible-name="Success callout">
      ${calloutContent}
      <bit-link href="#" end-icon="bwi-angle-right" class="tw-ml-2">Visit the help center</bit-link>
    </bit-callout>
  `,
};

export const WithFooterButtons: Story = {
  render: () => html`
    <div class="tw-flex tw-flex-col tw-gap-4">
      <bit-callout heading=${calloutTitle}>
        ${calloutContent}
        <bit-button slot="end" button-type="primary">Button text</bit-button>
        <bit-button slot="end" button-type="primaryOutline">Button text</bit-button>
      </bit-callout>
      <bit-callout type="warning">
        ${calloutContent}
        <bit-button slot="end" button-type="warning">Button text</bit-button>
        <bit-button slot="end" button-type="warningOutline">Button text</bit-button>
      </bit-callout>
    </div>
  `,
};

export const WithCloseButton: Story = {
  render: () => html`
    <div class="tw-flex tw-flex-col tw-gap-4">
      <bit-callout
        dismissible
        accessible-name="Success callout"
        @dismiss=${(e: Event) => (e.target as HTMLElement).remove()}
      >
        ${calloutContent}
      </bit-callout>
      <bit-callout
        dismissible
        heading=${calloutTitle}
        @dismiss=${(e: Event) => (e.target as HTMLElement).remove()}
      >
        ${calloutContent}
        <bit-button slot="end" button-type="primary">Button text</bit-button>
        <bit-button slot="end" button-type="primaryOutline">Button text</bit-button>
      </bit-callout>
    </div>
  `,
};
