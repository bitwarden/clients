import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import * as SvgIcons from "@bitwarden/assets/svg";

import "./svg";

const icons = Object.entries(SvgIcons).filter(([, value]) => SvgIcons.isBitSvg(value)) as [
  string,
  SvgIcons.BitSvg,
][];

export default {
  title: "Component Library/Svg",
  component: "bit-svg",
} satisfies Meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <div
      class="tw-bg-secondary-100 tw-p-2 tw-grid tw-grid-cols-[repeat(auto-fit,minmax(224px,1fr))] tw-gap-2"
    >
      ${icons.map(
        ([name, icon]) => html`
          <div class="tw-size-56 tw-border tw-border-solid tw-border-secondary-300 tw-rounded-md">
            <div class="tw-text-xs tw-text-center">${name}</div>
            <div class="tw-size-52 tw-w-full tw-content-center">
              <bit-svg .content=${icon}></bit-svg>
            </div>
          </div>
        `,
      )}
    </div>
  `,
};

export const WithLabel: Story = {
  render: () => html`
    <div class="tw-size-32">
      <bit-svg .content=${icons[0]?.[1]} label="Illustration"></bit-svg>
    </div>
  `,
};
