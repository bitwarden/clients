import { RouterTestingModule } from "@angular/router/testing";
import { StoryObj, Meta, moduleMetadata, applicationConfig } from "@storybook/angular";
import { expect, waitFor } from "storybook/test";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { GlobalStateProvider } from "@bitwarden/state";

import { IconButtonModule } from "../icon-button";
import { LayoutComponent } from "../layout";
import { positionFixedWrapperDecorator } from "../stories/storybook-decorators";
import { I18nMockService } from "../utils/i18n-mock.service";
import { StorybookGlobalStateProvider } from "../utils/state-mock";

import { NavItemComponent } from "./nav-item.component";
import { NavigationModule } from "./navigation.module";

export default {
  title: "Component Library/Nav/Nav Item/Interaction States",
  component: NavItemComponent,
  tags: ["!autodocs"],
  decorators: [
    positionFixedWrapperDecorator(
      (story) => `<bit-layout><bit-side-nav>${story}</bit-side-nav></bit-layout>`,
    ),
    moduleMetadata({
      declarations: [],
      imports: [RouterTestingModule, IconButtonModule, NavigationModule, LayoutComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              submenu: "submenu",
              toggleCollapse: "toggle collapse",
              toggleSideNavigation: "Toggle side navigation",
              skipToContent: "Skip to content",
              loading: "Loading",
              resizeSideNavigation: "Resize side navigation",
              sideNavigation: "Side navigation",
              skipLink: "Skip link",
            });
          },
        },
      ],
    }),
    applicationConfig({
      providers: [
        {
          provide: GlobalStateProvider,
          useClass: StorybookGlobalStateProvider,
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-40145&t=b5tDKylm5sWm2yKo-4",
    },
    chromatic: {
      // temporarily disabled while figuring out why the snapshots are flaky
      disableSnapshot: true,
    },
  },
} as Meta;

type Story = StoryObj<NavItemComponent>;

export const Hover: Story = {
  render: (args) => ({
    template: /*html*/ `
        <bit-nav-item text="Nav Item Hover"></bit-nav-item>
      `,
  }),
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByTestId("nav-item-container")).toBeInTheDocument();

      const navItemContainer = await canvas.findByTestId("nav-item-container");

      if (!navItemContainer) {
        // eslint-disable-next-line
        console.error("Can't find nav item elements needed for hover test");
        return;
      }

      navItemContainer.classList.add("tw-test-hover");

      await expect(navItemContainer.classList).toContain("tw-test-hover");
    });
  },
  parameters: {
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
};

export const Focus: Story = {
  render: (args) => ({
    template: /*html*/ `
        <bit-nav-item text="Nav Item Focus"></bit-nav-item>
      `,
  }),
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByTestId("nav-item-interactive")).toBeInTheDocument();

      const navItemEl = await canvas.findByTestId("nav-item-interactive");

      navItemEl.focus();

      await expect(navItemEl).toHaveFocus();
    });
  },
  parameters: {
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
};

export const ActiveHover: Story = {
  render: (args) => ({
    template: /*html*/ `
        <bit-nav-item text="Nav Item Active Hover" [forceActiveStyles]="true"></bit-nav-item>
      `,
  }),
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByTestId("nav-item-container")).toBeInTheDocument();

      const navItemContainer = await canvas.findByTestId("nav-item-container");

      if (!navItemContainer) {
        // eslint-disable-next-line
        console.error("Can't find nav item elements needed for hover test");
        return;
      }

      navItemContainer.classList.add("tw-test-hover");

      await expect(navItemContainer.classList).toContain("tw-test-hover");
    });
  },
  parameters: {
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
};

export const ActiveFocus: Story = {
  render: (args) => ({
    template: /*html*/ `
        <bit-nav-item text="Nav Item Active Focus" [forceActiveStyles]="true"></bit-nav-item>
      `,
  }),
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByTestId("nav-item-interactive")).toBeInTheDocument();

      const navItemEl = await canvas.findByTestId("nav-item-interactive");

      navItemEl.focus();

      await expect(navItemEl).toHaveFocus();
    });
  },
  parameters: {
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
};
