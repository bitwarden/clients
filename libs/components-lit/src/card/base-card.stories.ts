import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "./base-card";

export default {
  title: "Component Library/Cards/BaseCard",
  component: "bit-base-card",
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-28355&t=b5tDKylm5sWm2yKo-4",
    },
  },
} satisfies Meta;

type Story = StoryObj;

/** Cards are presentational containers. */
export const Default: Story = {
  render: () => html`
    <bit-base-card>
      <p class="tw-text-base !tw-mb-0">
        The <code>&lt;bit-base-card&gt;</code> component is a container that applies our standard
        border and box-shadow. In most cases, <code>&lt;bit-card&gt;</code> should be used for
        consistency
      </p>
      <p class="tw-text-base !tw-mb-0">
        <code>&lt;bit-base-card&gt;</code> is used in the
        <a href="#" class="tw-text-fg-brand tw-underline">ReportCardComponent</a> and
        <strong>IntegrationsCardComponent</strong> since they have custom padding requirements
      </p>
    </bit-base-card>
  `,
};
