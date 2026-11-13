import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, nothing } from "lit";

import type { BerryVariant } from "./berry";
import "./berry";

type Args = { type: string; variant: string; value?: number; maxDigits?: number };

const variants: BerryVariant[] = [
  "primary",
  "subtle",
  "success",
  "warning",
  "danger",
  "accentPrimary",
  "contrast",
];

export default {
  title: "Component Library/Berry",
  component: "bit-berry",
  args: { type: "count", variant: "primary", value: 5, maxDigits: undefined },
  argTypes: {
    type: {
      control: "select",
      options: ["status", "count"],
      description: "The type of the berry, which determines its size and content",
    },
    variant: { control: "select", options: variants },
    value: {
      control: "number",
      description:
        "Value displayed by count berries. If 0, negative or undefined, a count berry is hidden.",
    },
    maxDigits: {
      control: "number",
      description:
        "Limits the digits displayed in a count berry (e.g. 2 shows 99+ for values ≥ 100).",
    },
  },
  render: (args) => html`
    <bit-berry
      type=${args.type}
      variant=${args.variant}
      value=${args.value ?? nothing}
      max-digits=${args.maxDigits ?? nothing}
    ></bit-berry>
  `,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Primary: Story = {};

export const StatusType: Story = {
  render: () => html`
    <div class="tw-flex tw-items-center tw-gap-4">
      ${variants
        .filter((v) => v !== "contrast")
        .map((v) => html`<bit-berry type="status" variant=${v}></bit-berry>`)}
      <div class="tw-p-2 tw-bg-bg-contrast">
        <bit-berry type="status" variant="contrast"></bit-berry>
      </div>
    </div>
  `,
};

export const CountType: Story = {
  render: () => html`
    <div class="tw-flex tw-items-center tw-gap-4">
      <bit-berry value="5"></bit-berry>
      <bit-berry value="50"></bit-berry>
      <bit-berry value="500"></bit-berry>
      <bit-berry value="5000"></bit-berry>
    </div>
  `,
};

export const WithMaxDigits: Story = { args: { value: 100, maxDigits: 2 } };

const labels: Record<BerryVariant, string> = {
  primary: "Primary:",
  subtle: "Subtle:",
  success: "Success:",
  warning: "Warning:",
  danger: "Danger:",
  accentPrimary: "Accent primary:",
  contrast: "Contrast:",
};

export const AllVariants: Story = {
  render: () => html`
    <div class="tw-flex tw-flex-col tw-gap-4">
      ${variants.map(
        (v) => html`
          <div
            class="tw-flex tw-items-center tw-gap-4 ${v === "contrast" ? "tw-bg-bg-contrast" : ""}"
          >
            <span class="tw-w-20 ${v === "contrast" ? "tw-text-fg-contrast" : ""}"
              >${labels[v]}</span
            >
            <bit-berry type="status" variant=${v}></bit-berry>
            ${[5, 50, 500, 5000].map(
              (value) => html`<bit-berry variant=${v} value=${value}></bit-berry>`,
            )}
          </div>
        `,
      )}
    </div>
  `,
};
