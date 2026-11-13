import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import { positionFixedWrapperDecorator } from "../storybook-decorators";

import "./kitchen-sink-app";
import {
  activate,
  clickDeep,
  deepQueryAll,
  findDeep,
  navigateTo,
  openSideNav,
  wait,
} from "./story-queries";

type Args = { legacy: boolean };

export default {
  title: "Documentation/Kitchen Sink",
  component: "bit-kitchen-sink-app",
  decorators: [positionFixedWrapperDecorator()],
  // The Angular kitchen sink defaults to the `VFO1Foundation` flag off.
  args: { legacy: true },
  render: (args) => html`<bit-kitchen-sink-app ?legacy=${args.legacy}></bit-kitchen-sink-app>`,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

const vfo1 = { legacy: false };

const dismissBanner: Story["play"] = async ({ canvasElement }) => {
  const banner = await findDeep(canvasElement, "bit-banner");
  await clickDeep(banner.shadowRoot!, "bit-icon-button");
};

export const Default: Story = {
  parameters: {
    chromatic: {
      viewports: [640, 1280],
    },
  },
};

export const DefaultVfo1: Story = { ...Default, args: vfo1 };

export const DefaultNoBanner: Story = {
  ...Default,
  play: dismissBanner,
  parameters: {
    chromatic: {
      viewports: [1280],
    },
  },
};

export const DefaultVfo1NoBanner: Story = { ...DefaultNoBanner, args: vfo1 };

export const MenuOpen: Story = {
  play: async ({ canvasElement }) => {
    await navigateTo("/bitwarden");
    const table = await findDeep(canvasElement, "bit-table-v2");
    await clickDeep(table.shadowRoot!, "bit-icon-button", "Options");
  },
  parameters: {
    chromatic: { ignoreSelectors: [".bit-menu-panel-backdrop"] },
  },
};

export const DialogOpen: Story = {
  play: async ({ canvasElement }) => {
    await navigateTo("/bitwarden");
    await clickDeep(canvasElement, "bit-button", "Open Dialog");
  },
};

export const DrawerOpen: Story = {
  play: async ({ canvasElement }) => {
    await navigateTo("/bitwarden");
    await clickDeep(canvasElement, "bit-button", "Open Drawer");
  },
};

export const PopoverOpen: Story = {
  play: async ({ canvasElement }) => {
    await navigateTo("/bitwarden");
    await clickDeep(canvasElement, "bit-link", "Popover trigger link");
  },
};

export const SimpleDialogOpen: Story = {
  play: async ({ canvasElement }) => {
    await navigateTo("/bitwarden");
    await clickDeep(canvasElement, "bit-button", "Submit");
  },
};

export const EmptyTab: Story = {
  play: async ({ canvasElement }) => {
    await navigateTo("/bitwarden");
    await wait(200); // wait for the overflow measurement to settle

    const emptyTab = await findDeep(canvasElement, "bit-tab-link", "Empty");
    if (emptyTab.checkVisibility()) {
      activate(emptyTab);
    } else {
      // The Empty tab is in the overflow "More" menu at this viewport width
      const tabBar = await findDeep(canvasElement, "bit-tab-nav-bar");
      await clickDeep(tabBar.shadowRoot!, "button, bit-button, bit-icon-button", "More");
      await clickDeep(canvasElement.ownerDocument.body, "bit-menu-item", "Empty");
    }
  },
};

export const VirtualScrollBlockingDialog: Story = {
  play: async ({ canvasElement }) => {
    await navigateTo("/virtual-scroll");

    const table = await findDeep(canvasElement, "dialog-virtual-scroll-block bit-table-v2");
    await wait(100);
    // `height="fill"` scrolls the table body rather than the document.
    const scroller = deepQueryAll(table.shadowRoot!, "*").find(
      (el) => el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY === "auto",
    );
    if (scroller) {
      scroller.scrollTop = 2000;
    }
    await wait(100);

    await clickDeep(table.shadowRoot!, "bit-icon-button", "Options");
  },
};

export const SideNavOpen: Story = {
  play: async ({ canvasElement }) => {
    await navigateTo("/bitwarden");
    await openSideNav(canvasElement);
  },
  parameters: {
    chromatic: { viewports: [640, 1024, 1280] },
  },
};

export const DrawerOpenBeforeSideNavOpen: Story = {
  play: async ({ canvasElement }) => {
    await clickDeep(canvasElement, "bit-button", "Open Drawer");

    await navigateTo("/bitwarden");
    await openSideNav(canvasElement);
  },
  parameters: {
    chromatic: { viewports: [640, 1024, 1280, 1440] },
  },
};

export const ResponsiveSidebar: Story = {
  parameters: {
    chromatic: {
      viewports: [640, 1024, 1280, 1440],
    },
  },
};

export const GuidedTour: Story = {
  play: async ({ canvasElement }) => {
    await navigateTo("/bitwarden");
    await clickDeep(canvasElement, "bit-button", "Start Tour");
  },
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};
