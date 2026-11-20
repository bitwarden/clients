import { importProvidersFrom } from "@angular/core";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import {
  userEvent,
  getByRole,
  queryByRole,
  fireEvent,
  getAllByLabelText,
  findByTestId,
} from "storybook/test";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { GlobalStateProvider } from "@bitwarden/state";
import { enabledFlags } from "@bitwarden/storybook";

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
import {
  KITCHEN_SINK_TABLE_V2_STRESS,
  KitchenSinkTableV2Stress,
} from "./components/kitchen-sink-table-v2.component";
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
              moreBreadcrumbs: "More breadcrumbs",
              breadcrumbs: "Breadcrumbs",
              sideNavigation: "Side navigation",
              skipLink: "Skip link",
              more: "More",
              showMore: "Show more",
              showMoreCount: "Show 5 more",
              resetSearch: "Reset search",
              back: "Back",
              backTo: (name) => `Back to ${name}`,
              removeItem: (name) => `Remove ${name}`,
              clearFilters: "Clear all filters",
              filtersApplied: (count) => `${count} filters applied`,
              nothingToShow: "Nothing to show",
              noMatchingItems: "No matching items",
              noFiltersMatchTerm: (term) => `No filters match “${term}”`,
              clearSearch: "Clear search",
              oneFilterResult: "1 result",
              filterResults: (count) => `${count} results`,
              showingItemRange: (start, end, total) => `Showing ${start} - ${end} of ${total}`,
              rowsPerPage: "Rows per page",
              rowsPerPageOption: (count) => `${count} rows per page`,
              itemCount: (count) => `${count} items`,
              all: "All",
              filter: "Filter",
              filters: "Filters",
              done: "Done",
              clearAll: "Clear all",
              filtersSelected: (count) => `${count} selected`,
              selectAllRows: "Select all rows",
              selectRow: "Select row",
              previousPage: "Previous page",
              nextPage: "Next page",
              goToPage: "Go to page",
              ofPageCount: (count) => `of ${count}`,
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

async function navigateTo(path: KitchenSinkRoute) {
  window.location.hash = path;
  await new Promise((resolve) => setTimeout(resolve, 50));
}

/** Waits for the ResizeObserver + Angular CD to settle, then opens the side nav if it's closed. */
async function openSideNav(canvas: HTMLElement) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const toggleButton = getByRole(canvas, "button", { name: "Toggle side navigation" });
  if (toggleButton.getAttribute("aria-expanded") === "false") {
    await userEvent.click(toggleButton);
  }
}

export const Default: Story = {
  parameters: {
    chromatic: {
      viewports: [640, 1280],
    },
  },
};

export const DefaultVfo1: Story = {
  ...Default,
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
};

/**
 * Perf stress: the table v2 at the scale that locks up Desktop for the largest organizations
 * (PM-47136): 23,000 items across a 3,000-folder Shared folders chip. The scale is set by args,
 * so it can be changed from the controls panel or the story URL (`&args=rows:10000;sharedFolders:1000`).
 * Not snapshotted; it exists to be driven by `scripts/perf/table-v2-stress.mjs`.
 */
export const TableV2Stress: StoryObj<KitchenSinkTableV2Stress> = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  args: {
    rows: 23_000,
    sharedFolders: 3_000,
    users: 20,
    features: 50,
    pageSize: 25,
    virtualized: false,
  },
  decorators: [
    // Args arrive as strings from the URL, so coerce before handing them to the generator.
    (storyFn, context) =>
      applicationConfig({
        providers: [
          {
            provide: KITCHEN_SINK_TABLE_V2_STRESS,
            useValue: {
              rows: Number(context.args.rows),
              sharedFolders: Number(context.args.sharedFolders),
              users: Number(context.args.users),
              features: Number(context.args.features),
              pageSize: Number(context.args.pageSize),
              virtualized: String(context.args.virtualized) === "true",
            } satisfies KitchenSinkTableV2Stress,
          },
        ],
      })(storyFn, context),
  ],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};

export const DefaultNoBanner: Story = {
  ...Default,
  play: async (context) => {
    const canvas = context.canvasElement;
    const bannerClose = await findByTestId(canvas, "bit-banner-close-btn");
    await userEvent.click(bannerClose);
  },
  parameters: {
    chromatic: {
      viewports: [1280],
    },
  },
};

export const DefaultVfo1NoBanner: Story = {
  ...Default,
  play: async (context) => {
    const canvas = context.canvasElement;
    const bannerClose = await findByTestId(canvas, "bit-banner-close-btn");
    await userEvent.click(bannerClose);
  },
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  parameters: {
    chromatic: {
      viewports: [1280],
    },
  },
};

export const MenuOpen: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;
    await navigateTo("/bitwarden");
    const table = getByRole(canvas, "table");
    const menuButton = getAllByLabelText(table, "Options")[0];
    await userEvent.click(menuButton);
  },
  parameters: {
    chromatic: { ignoreSelectors: [".bit-menu-panel-backdrop"] },
  },
};

export const DialogOpen: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;
    await navigateTo("/bitwarden");
    const dialogButton = getByRole(canvas, "button", {
      name: "Open Dialog",
    });

    // workaround for userEvent not firing in FF https://github.com/testing-library/user-event/issues/1075
    await fireEvent.click(dialogButton);
  },
};

export const DrawerOpen: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;
    await navigateTo("/bitwarden");
    const drawerButton = getByRole(canvas, "button", {
      name: "Open Drawer",
    });

    // workaround for userEvent not firing in FF https://github.com/testing-library/user-event/issues/1075
    await fireEvent.click(drawerButton);
  },
};

export const PopoverOpen: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;
    await navigateTo("/bitwarden");
    const popoverLink = getByRole(canvas, "button", {
      name: "Popover trigger link",
    });

    await userEvent.click(popoverLink);
  },
};

export const SimpleDialogOpen: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;
    await navigateTo("/bitwarden");
    const submitButton = getByRole(canvas, "button", {
      name: "Submit",
    });

    // workaround for userEvent not firing in FF https://github.com/testing-library/user-event/issues/1075
    await fireEvent.click(submitButton);
  },
};

export const EmptyTab: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;
    await navigateTo("/bitwarden");
    await new Promise((resolve) => setTimeout(resolve, 200)); // wait for ResizeObserver to settle

    const emptyTab = queryByRole(canvas, "link", { name: "Empty" });
    if (emptyTab) {
      await userEvent.click(emptyTab);
    } else {
      // Empty tab is in the overflow "More" menu at this viewport width
      const moreButton = getByRole(canvas, "button", { name: "More" });
      await userEvent.click(moreButton);
      const emptyMenuItem = getByRole(canvas.ownerDocument.body, "menuitem", { name: "Empty" });
      await userEvent.click(emptyMenuItem);
    }
  },
};

export const VirtualScrollBlockingDialog: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;
    await navigateTo("/virtual-scroll");

    const htmlEl = canvas.ownerDocument.documentElement;
    htmlEl.scrollTop = 2000;

    const dialogButton = getAllByLabelText(canvas, "Options")[0];

    await userEvent.click(dialogButton);
  },
};

export const SideNavOpen: Story = {
  render: Default.render,
  play: async (context) => {
    const canvas = context.canvasElement;
    await navigateTo("/bitwarden");
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
    await fireEvent.click(getByRole(canvas, "button", { name: "Open Drawer" }));

    await navigateTo("/bitwarden");
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
    await navigateTo("/bitwarden");

    const tourButton = getByRole(canvas, "button", {
      name: "Start Tour",
    });

    // workaround for userEvent not firing in FF https://github.com/testing-library/user-event/issues/1075
    await fireEvent.click(tourButton);
  },
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};
