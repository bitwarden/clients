import { importProvidersFrom } from "@angular/core";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import {
  userEvent,
  getAllByRole,
  getByRole,
  fireEvent,
  getAllByLabelText,
  waitFor,
} from "storybook/test";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { GlobalStateProvider } from "@bitwarden/state";

import { I18nMockService } from "../../utils/i18n-mock.service";
import { StorybookGlobalStateProvider } from "../../utils/state-mock";
import { positionFixedWrapperDecorator } from "../storybook-decorators";

import { DialogVirtualScrollBlockComponent } from "./components/dialog-virtual-scroll-block.component";
import { KitchenSinkAppComponent } from "./components/kitchen-sink-app.component";
import { KitchenSinkEmptyComponent } from "./components/kitchen-sink-empty.component";
import { KitchenSinkFormComponent } from "./components/kitchen-sink-form.component";
import {
  KitchenSinkDialogWithAutofocusComponent,
  KitchenSinkMainComponent,
} from "./components/kitchen-sink-main.component";
import { KitchenSinkTableComponent } from "./components/kitchen-sink-table.component";
import { KitchenSinkToggleListComponent } from "./components/kitchen-sink-toggle-list.component";
import { KitchenSinkVaultComponent } from "./components/kitchen-sink-vault.component";
import { KitchenSinkSharedModule } from "./kitchen-sink-shared.module";

export default {
  title: "Documentation / Kitchen Sink",
  component: KitchenSinkAppComponent,
  decorators: [
    positionFixedWrapperDecorator(),
    moduleMetadata({
      imports: [
        KitchenSinkSharedModule,
        KitchenSinkAppComponent,
        KitchenSinkDialogWithAutofocusComponent,
        KitchenSinkEmptyComponent,
        KitchenSinkFormComponent,
        KitchenSinkMainComponent,
        KitchenSinkTableComponent,
        KitchenSinkToggleListComponent,
        KitchenSinkVaultComponent,
      ],
    }),
    applicationConfig({
      providers: [
        provideNoopAnimations(),
        importProvidersFrom(
          RouterModule.forRoot(
            [
              {
                path: "",
                component: KitchenSinkMainComponent,
                children: [
                  { path: "", redirectTo: "bitwarden", pathMatch: "full" },
                  { path: "bitwarden", component: KitchenSinkVaultComponent },
                  { path: "empty", component: KitchenSinkEmptyComponent },
                  { path: "virtual-scroll", component: DialogVirtualScrollBlockComponent },
                ],
              },
            ],
            { useHash: true },
          ),
        ),
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              close: "Close",
              search: "Search",
              selectPlaceholder: "-- Select --",
              skipToContent: "Skip to content",
              submenu: "submenu",
              toggleCollapse: "toggle collapse",
              toggleSideNavigation: "Toggle side navigation",
              yes: "Yes",
              no: "No",
              loading: "Loading",
              resizeSideNavigation: "Resize side navigation",
              sideNavigation: "Side navigation",
              skipLink: "Skip link",
            });
          },
        },
        {
          provide: PlatformUtilsService,
          useValue: {
            // eslint-disable-next-line
            copyToClipboard: (text: string) => console.log(`${text} copied to clipboard`),
          },
        },
        {
          provide: GlobalStateProvider,
          useClass: StorybookGlobalStateProvider,
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<KitchenSinkAppComponent>;

type KitchenSinkRoute = "/bitwarden" | "/virtual-scroll";

async function navigateAndWaitFor<T>(path: KitchenSinkRoute, ready: () => T): Promise<T> {
  window.location.hash = path;
  return waitFor(ready);
}

/** Opens the side nav if it's closed, waiting for it to appear and fully open. */
async function openSideNav(canvas: HTMLElement) {
  const toggleButton = await waitFor(
    () => getByRole(canvas, "button", { name: "Toggle side navigation" }),
    { timeout: 5000 },
  );
  if (toggleButton.getAttribute("aria-expanded") === "false") {
    await userEvent.click(toggleButton);
    await waitFor(
      () => {
        // Re-query to avoid reading a stale reference after Angular re-renders the element.
        const btn = getByRole(canvas, "button", { name: "Toggle side navigation" });
        if (btn.getAttribute("aria-expanded") !== "true") {throw new Error();}
      },
      { timeout: 5000 },
    );
  }
}

export const Default: Story = {
  parameters: {
    chromatic: {
      viewports: [640, 1280],
    },
  },
};

export const MenuOpen: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;
    const table = await navigateAndWaitFor("/bitwarden", () => getByRole(canvas, "table"));
    const menuButton = getAllByRole(table, "button")[0];
    await userEvent.click(menuButton);
  },
  parameters: {
    chromatic: { ignoreSelectors: [".bit-menu-panel-backdrop"] },
  },
};

export const DialogOpen: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;
    const dialogButton = await navigateAndWaitFor("/bitwarden", () =>
      getByRole(canvas, "button", { name: "Open Dialog" }),
    );

    // workaround for userEvent not firing in FF https://github.com/testing-library/user-event/issues/1075
    await fireEvent.click(dialogButton);
  },
};

export const DrawerOpen: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;
    const drawerButton = await navigateAndWaitFor("/bitwarden", () =>
      getByRole(canvas, "button", { name: "Open Drawer" }),
    );

    // workaround for userEvent not firing in FF https://github.com/testing-library/user-event/issues/1075
    await fireEvent.click(drawerButton);
  },
};

export const PopoverOpen: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;
    const popoverLink = await navigateAndWaitFor("/bitwarden", () =>
      getByRole(canvas, "button", { name: "Popover trigger link" }),
    );

    await userEvent.click(popoverLink);
  },
};

export const SimpleDialogOpen: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;
    const submitButton = await navigateAndWaitFor("/bitwarden", () =>
      getByRole(canvas, "button", { name: "Submit" }),
    );

    // workaround for userEvent not firing in FF https://github.com/testing-library/user-event/issues/1075
    await fireEvent.click(submitButton);
    await waitFor(() => {
      if (!canvas.ownerDocument.querySelector("cdk-dialog-container")) {throw new Error();}
    });
  },
};

export const EmptyTab: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;
    const emptyTab = await navigateAndWaitFor("/bitwarden", () =>
      getByRole(canvas, "link", { name: "Empty" }),
    );
    await userEvent.click(emptyTab);
  },
};

export const VirtualScrollBlockingDialog: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;
    const dialogButton = await navigateAndWaitFor("/virtual-scroll", () => {
      canvas.ownerDocument.documentElement.scrollTop = 2000;
      return getAllByLabelText(canvas, "Options")[0];
    });

    await userEvent.click(dialogButton);
    await waitFor(() => {
      if (!canvas.ownerDocument.querySelector("cdk-dialog-container")) {throw new Error();}
    });
  },
};

export const SideNavOpen: Story = {
  render: Default.render,
  play: async (context) => {
    const canvas = context.canvasElement;
    await navigateAndWaitFor("/bitwarden", () =>
      getByRole(canvas, "button", { name: "Toggle side navigation" }),
    );
    await openSideNav(canvas);
  },
  parameters: {
    chromatic: { viewports: [640, 1024, 1280] },
  },
};

export const DrawerOpenBeforeSideNavOpen: Story = {
  render: Default.render,
  play: async (context) => {
    const canvas = context.canvasElement;
    // workaround for userEvent not firing in FF https://github.com/testing-library/user-event/issues/1075
    await fireEvent.click(
      await navigateAndWaitFor("/bitwarden", () =>
        getByRole(canvas, "button", { name: "Open Drawer" }),
      ),
    );
    await openSideNav(canvas);
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
  play: async (context) => {
    const canvas = context.canvasElement;
    const tourButton = await navigateAndWaitFor("/bitwarden", () =>
      getByRole(canvas, "button", { name: "Start Tour" }),
    );

    // workaround for userEvent not firing in FF https://github.com/testing-library/user-event/issues/1075
    await fireEvent.click(tourButton);
  },
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};
