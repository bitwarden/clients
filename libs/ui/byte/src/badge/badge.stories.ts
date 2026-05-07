import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "./badge";

type Args = {
  variant: "primary" | "subtle" | "success" | "danger" | "warning" | "accent-primary";
  size: "small" | "large";
  truncate: boolean;
  label: string;
};

const meta: Meta<Args> = {
  title: "byte/Badge",
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "subtle", "success", "danger", "warning", "accent-primary"],
    },
    size: {
      control: "select",
      options: ["small", "large"],
    },
    truncate: { control: "boolean" },
    label: { control: "text" },
  },
  args: {
    variant: "primary",
    size: "large",
    truncate: true,
    label: "Badge text",
  },
  render: ({ variant, size, truncate, label }) => html`
    <bit-badge variant=${variant} size=${size} ?truncate=${truncate}>${label}</bit-badge>
  `,
};

export default meta;

export const Default: StoryObj<Args> = {};

export const AllVariants: StoryObj<Args> = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start;">
      <bit-badge variant="primary">Primary</bit-badge>
      <bit-badge variant="subtle">Subtle</bit-badge>
      <bit-badge variant="success">Success</bit-badge>
      <bit-badge variant="warning">Warning</bit-badge>
      <bit-badge variant="danger">Danger</bit-badge>
      <bit-badge variant="accent-primary">Accent Primary</bit-badge>
    </div>
  `,
};

export const Small: StoryObj<Args> = {
  args: { size: "small" },
};

export const Truncated: StoryObj<Args> = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 400px;">
      <bit-badge>Short</bit-badge>
      <bit-badge>This is a very long badge text that will automatically truncate</bit-badge>
      <bit-badge ?truncate=${false}
        >This is a very long badge text that will NOT truncate</bit-badge
      >
    </div>
  `,
};

export const WithStartSlot: StoryObj<Args> = {
  render: () => html`
    <bit-badge variant="success">
      <span slot="start" aria-hidden="true">✓</span>
      Verified
    </bit-badge>
  `,
};
