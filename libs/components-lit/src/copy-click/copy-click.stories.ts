import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, nothing } from "lit";

import "../icon-button/icon-button";
import type { CopyClickToastVariant } from "./attach-copy-click";
import "./copy-click";
import { copyClick } from "./copy-click-directive";

type Args = { value: string; showToast?: boolean | CopyClickToastVariant; valueLabel?: string };

export default {
  title: "Component Library/Copy Click Directive",
  args: { value: "testValue123" },
  render: (args) => html`
    <div class="tw-flex tw-items-center tw-gap-2">
      <label class="tw-flex tw-items-center tw-gap-2"
        >API Key <input class="tw-border tw-p-2" disabled .value=${args.value}
      /></label>
      <bit-icon-button
        icon="bwi-clone"
        label="Copy"
        ${copyClick(args.value, { showToast: args.showToast, valueLabel: args.valueLabel })}
      ></bit-icon-button>
    </div>
  `,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

export const WithDefaultToast: Story = { args: { showToast: true } };

export const WithCustomToastVariant: Story = { args: { showToast: "info" } };

export const WithCustomValueLabel: Story = { args: { showToast: true, valueLabel: "API Key" } };

export const WrapperElement: Story = {
  args: { showToast: true },
  render: (args) => html`
    <bit-copy-click
      value=${args.value}
      ?show-toast=${args.showToast === true}
      value-label=${args.valueLabel ?? nothing}
      @copied=${(e: CustomEvent<{ value: string }>) => (e.target as HTMLElement).setAttribute("data-last-copied", e.detail.value)}
    >
      <bit-icon-button icon="bwi-clone" label="Copy"></bit-icon-button>
    </bit-copy-click>
  `,
};
