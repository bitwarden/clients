import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, nothing } from "lit";

import "../button/button";

import "./toast";
import type { ToastVariant } from "./toast";
import "./toast-container";
import { showToast } from "./toast-service";

type Args = {
  variant: ToastVariant;
  progressWidth: number;
  title: string;
  message: string | string[];
  timeout?: number;
};

const toast = (args: Args, variant = args.variant) =>
  html`<bit-toast
    variant=${variant}
    heading=${args.title || nothing}
    .message=${args.message}
    progress-width=${args.progressWidth}
  ></bit-toast>`;

export default {
  title: "Component Library/Toast",
  component: "bit-toast",
  args: { variant: "info", progressWidth: 50, title: "", message: "Hello Bitwarden!" },
  argTypes: {
    variant: { control: "select", options: ["success", "error", "info", "warning"] },
  },
  render: (args) => html`<div class="tw-max-w-[19rem]">${toast(args)}</div>`,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

export const Variants: Story = {
  render: (args) =>
    html`<div class="tw-flex tw-flex-col tw-max-w-[19rem] tw-gap-2">
      ${(["success", "info", "warning", "error"] as const).map((variant) => toast(args, variant))}
    </div>`,
};

/** Avoid long messages in toasts. */
export const LongContent: Story = {
  args: {
    title: "Foo",
    message: [
      "Maecenas commodo posuere quam, vel malesuada nulla accumsan ac.",
      "Pellentesque interdum ligula ante, eget bibendum ante lacinia congue.",
    ],
  },
};

/** `showToast()` with a `bit-toast-container`. Hovering a toast pauses its timer. */
export const Service: Story = {
  args: { title: "", message: "Hello Bitwarden!", variant: "error", timeout: 5000 },
  parameters: { chromatic: { disableSnapshot: true } },
  render: (args) => html`
    <bit-toast-container></bit-toast-container>
    <bit-button
      @click=${() =>
        showToast({
          variant: args.variant,
          title: args.title,
          message: args.message,
          timeout: args.timeout,
        })}
      >Show Toast</bit-button
    >
  `,
};

/** Placement options for `bit-toast-container`. */
export const FullWidth: Story = {
  args: { message: "Saved", variant: "success" },
  parameters: { chromatic: { disableSnapshot: true } },
  render: (args) => html`
    <bit-toast-container position="top-full-width" max-opened="2"></bit-toast-container>
    <bit-button @click=${() => showToast({ variant: args.variant, message: args.message })}
      >Show Toast</bit-button
    >
  `,
};
