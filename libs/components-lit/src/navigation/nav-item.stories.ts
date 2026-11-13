import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, nothing } from "lit";

import { inLayout, LayoutStoryArgs } from "./story-helpers";
import "./nav-divider";
import "./nav-item";
import "./side-nav";
import "../icon-button/icon-button";
import "../layout/layout";

type Args = LayoutStoryArgs & { text: string; icon?: string; href?: string };

export default {
  title: "Component Library/Nav/Nav Item",
  component: "bit-nav-item",
  decorators: [(story, { args }) => inLayout(args as Args, story() as never)],
  render: (args) =>
    html`<bit-nav-item
      text=${args.text}
      icon=${args.icon ?? nothing}
      href=${args.href ?? nothing}
    ></bit-nav-item>`,
  args: { legacy: true, text: "Hello World", icon: "bwi-grid", href: "#" },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-40145&t=b5tDKylm5sWm2yKo-4",
    },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

export const WithoutIcon: Story = { args: { icon: undefined } };

export const WithLongText: Story = { args: { text: "Hello World This Is a Cool Item" } };

export const WithoutRoute: Story = {
  render: () => html`<bit-nav-item text="Hello World" icon="bwi-shared-folder"></bit-nav-item>`,
};

const editButtons = html`<bit-icon-button
    slot="end"
    icon="bwi-pencil-square"
    button-type="side-nav"
    size="xsmall"
    label="Edit"
  ></bit-icon-button>
  <bit-icon-button
    slot="end"
    icon="bwi-check"
    button-type="side-nav"
    size="xsmall"
    label="Confirm"
  ></bit-icon-button>`;

export const WithChildButtons: Story = {
  render: () =>
    html`<bit-nav-item text="Hello World Very Cool World" href="#" icon="bwi-shared-folder">
      ${editButtons}
    </bit-nav-item>`,
};

export const MultipleItemsWithDivider: Story = {
  render: () => html`
    <bit-nav-item text="Hello World"></bit-nav-item>
    <bit-nav-item text="Hello World Long Text Long"></bit-nav-item>
    <bit-nav-divider></bit-nav-divider>
    <bit-nav-item text="Hello World" icon="bwi-shared-folder"></bit-nav-item>
    <bit-nav-item text="Hello World" icon="bwi-shared-folder"></bit-nav-item>
  `,
};

const forceActive = html`
  <bit-nav-item text="First Nav" icon="bwi-shared-folder"></bit-nav-item>
  <bit-nav-item text="Active Nav" icon="bwi-shared-folder" force-active-styles></bit-nav-item>
  <bit-nav-item text="Third Nav" icon="bwi-shared-folder"></bit-nav-item>
`;

export const ForceActiveStyles: Story = { render: () => forceActive };

export const ForceActiveStylesVfo1: Story = { args: { legacy: false }, render: () => forceActive };

/**
 * `active` replaces `routerLinkActive`: the app marks the item for the current page, which shows
 * active styles and sets `aria-current="page"`.
 */
export const ActiveVfo1: Story = {
  args: { legacy: false },
  render: () => html`
    <bit-nav-item text="Vault" icon="bwi-lock" href="#vault" active></bit-nav-item>
    <bit-nav-item text="Send" icon="bwi-send" href="#send"></bit-nav-item>
  `,
};

/** Collapsed items hide their label, so a tooltip names them on hover and keyboard focus. */
export const CollapsedVfo1: Story = {
  args: { legacy: false, collapsed: true },
  render: () => html`
    <bit-nav-item text="Vault" icon="bwi-lock" href="#"></bit-nav-item>
    <bit-nav-item text="Send" icon="bwi-send"></bit-nav-item>
    <bit-nav-item text="Reports With A Very Long Name" icon="bwi-bar-chart"></bit-nav-item>
  `,
};
