import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import type { BitNavItem } from "./nav-item";
import { inLayout, LayoutStoryArgs } from "./story-helpers";
import "./nav-item";
import "./side-nav";
import "../layout/layout";

type Args = LayoutStoryArgs;

export default {
  title: "Component Library/Nav/Nav Item/Interaction States",
  component: "bit-nav-item",
  tags: ["!autodocs"],
  decorators: [(story, { args }) => inLayout(args as Args, story() as never)],
  args: { legacy: true },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-40145&t=b5tDKylm5sWm2yKo-4",
    },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

const focusItem = async (canvasElement: HTMLElement) => {
  const item = canvasElement.querySelector<BitNavItem>("bit-nav-item");
  await item?.updateComplete;
  item?.shadowRoot?.querySelector<HTMLElement>("[data-testid='nav-item-interactive']")?.focus({
    focusVisible: true,
  } as FocusOptions);
};

export const Hover: Story = {
  render: () => html`<bit-nav-item class="tw-test-hover" text="Nav Item Hover"></bit-nav-item>`,
};

export const Focus: Story = {
  render: () =>
    html`<bit-nav-item class="tw-test-focus-visible" text="Nav Item Focus"></bit-nav-item>`,
  play: ({ canvasElement }) => focusItem(canvasElement),
};

export const ActiveHover: Story = {
  render: () =>
    html`<bit-nav-item
      class="tw-test-hover"
      text="Nav Item Active Hover"
      force-active-styles
    ></bit-nav-item>`,
};

export const ActiveFocus: Story = {
  render: () =>
    html`<bit-nav-item
      class="tw-test-focus-visible"
      text="Nav Item Active Focus"
      force-active-styles
    ></bit-nav-item>`,
  play: ({ canvasElement }) => focusItem(canvasElement),
};

export const HoverVfo1: Story = { ...Hover, args: { legacy: false } };

export const FocusVfo1: Story = { ...Focus, args: { legacy: false } };

export const ActiveHoverVfo1: Story = { ...ActiveHover, args: { legacy: false } };

export const ActiveFocusVfo1: Story = { ...ActiveFocus, args: { legacy: false } };
