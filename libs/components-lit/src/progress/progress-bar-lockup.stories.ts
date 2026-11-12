import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import { SpotReport } from "@bitwarden/assets/svg";

import "../svg/svg";

import "./progress-bar";
import "./progress-bar-lockup";

const bar = html`
  <bit-progress-bar value="50">
    <span slot="label">File name</span>
    <span slot="end">50MB</span>
  </bit-progress-bar>
`;

export default {
  title: "Component Library/Progress/Progress Bar Lockup",
  component: "bit-progress-bar-lockup",
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-40933&t=b5tDKylm5sWm2yKo-4",
    },
  },
} satisfies Meta;

type Story = StoryObj;

export const Base: Story = {
  render: () => html`
    <div class="tw-w-[552px]">
      <bit-progress-bar-lockup>
        <bit-svg slot="illustration" .content=${SpotReport} class="tw-w-[120px]"></bit-svg>
        <span slot="title">Uploading file</span>
        <span slot="description">This might take a few minutes.</span>
        ${bar}
      </bit-progress-bar-lockup>
    </div>
  `,
};

export const WithoutIllustration: Story = {
  render: () => html`
    <div class="tw-w-[552px]">
      <bit-progress-bar-lockup>
        <span slot="title">Uploading file</span>
        <span slot="description">This might take a few minutes.</span>
        ${bar}
      </bit-progress-bar-lockup>
    </div>
  `,
};
