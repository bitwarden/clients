import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../icon-button/icon-button";
import "../menu/menu";
import "../menu/menu-item";

import { hoverReveal } from "./hover-reveal";

const row =
  "tw-flex tw-items-center tw-justify-between tw-p-3 tw-rounded-xl tw-border tw-border-solid tw-border-border-base";

export default {
  title: "Component Library/Hover Reveal",
  parameters: { chromatic: { disableSnapshot: true } },
} satisfies Meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <div bit-hover-reveal-container data-testid="container" class=${row}>
      <span>Hover or tab into this row</span>
      <bit-icon-button bit-hover-reveal icon="bwi-pencil-square" label="Edit"></bit-icon-button>
    </div>
  `,
  // Snapshots can't hold a real pointer hover, so force the hover state with the test class
  play: async ({ canvasElement }) => {
    canvasElement.querySelector("[data-testid=container]")?.classList.add("tw-test-hover");
  },
  parameters: { chromatic: { disableSnapshot: false } },
};

export const WithMenu: Story = {
  render: () => html`
    <div bit-hover-reveal-container class=${row}>
      <span>The trigger stays visible while its menu is open</span>
      <bit-icon-button
        id="hover-reveal-menu-trigger"
        ${hoverReveal()}
        icon="bwi-ellipsis-v"
        label="Options"
      ></bit-icon-button>
      <bit-menu trigger="hover-reveal-menu-trigger">
        <bit-menu-item>Rename</bit-menu-item>
        <bit-menu-item variant="danger">Delete</bit-menu-item>
      </bit-menu>
    </div>
  `,
};

export const Nested: Story = {
  render: () => html`
    <div
      bit-hover-reveal-container
      class="tw-flex tw-flex-col tw-gap-3 tw-p-3 tw-rounded-xl tw-border tw-border-solid tw-border-border-base"
    >
      <div class="tw-flex tw-items-center tw-justify-between">
        <span>Outer container</span>
        <bit-icon-button bit-hover-reveal icon="bwi-pencil-square" label="Edit outer">
        </bit-icon-button>
      </div>
      <div bit-hover-reveal-container class=${row}>
        <span>Inner container, independent of the outer one</span>
        <bit-icon-button bit-hover-reveal icon="bwi-pencil-square" label="Edit inner">
        </bit-icon-button>
      </div>
    </div>
  `,
};

export const Boundary: Story = {
  render: () => html`
    <div
      bit-hover-reveal-container
      class="tw-flex tw-flex-col tw-gap-2 tw-p-3 tw-rounded-xl tw-border tw-border-solid tw-border-border-base"
    >
      <div class="tw-flex tw-items-center tw-justify-between">
        <span>Parent row</span>
        <bit-icon-button bit-hover-reveal icon="bwi-pencil-square" label="Edit"></bit-icon-button>
      </div>
      <ul bit-hover-reveal-boundary class="tw-m-0 tw-p-3 tw-rounded-xl tw-bg-bg-secondary">
        <li>Hovering here doesn't reveal "Edit"</li>
      </ul>
    </div>
  `,
};
