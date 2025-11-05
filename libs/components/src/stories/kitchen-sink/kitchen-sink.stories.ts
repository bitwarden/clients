import { importProvidersFrom } from "@angular/core";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import {
  userEvent,
  getAllByRole,
  getByRole,
  fireEvent,
  getByText,
  getAllByLabelText,
} from "@storybook/test";

import { PasswordManagerLogo } from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { LayoutComponent } from "../../layout";
import { I18nMockService } from "../../utils/i18n-mock.service";
import { positionFixedWrapperDecorator } from "../storybook-decorators";

import { DialogVirtualScrollBlockComponent } from "./components/dialog-virtual-scroll-block.component";
import { KitchenSinkForm } from "./components/kitchen-sink-form.component";
import { KitchenSinkMainComponent } from "./components/kitchen-sink-main.component";
import { KitchenSinkTable } from "./components/kitchen-sink-table.component";
import { KitchenSinkToggleList } from "./components/kitchen-sink-toggle-list.component";
import { KitchenSinkSharedModule } from "./kitchen-sink-shared.module";

export default {
  title: "Documentation / Kitchen Sink",
  component: LayoutComponent,
  decorators: [
    positionFixedWrapperDecorator(),
    moduleMetadata({
      imports: [
        KitchenSinkSharedModule,
        KitchenSinkForm,
        KitchenSinkMainComponent,
        KitchenSinkTable,
        KitchenSinkToggleList,
      ],
    }),
    applicationConfig({
      providers: [
        provideNoopAnimations(),
        importProvidersFrom(
          RouterModule.forRoot(
            [
              { path: "", redirectTo: "bitwarden", pathMatch: "full" },
              { path: "bitwarden", component: KitchenSinkMainComponent },
              { path: "virtual-scroll", component: DialogVirtualScrollBlockComponent },
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
              skipToContent: "Skip to content",
              submenu: "submenu",
              toggleCollapse: "toggle collapse",
              toggleSideNavigation: "Toggle side navigation",
              yes: "Yes",
              no: "No",
              loading: "Loading",
            });
          },
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<LayoutComponent>;

export const Default: Story = {
  render: (args) => {
    return {
      props: {
        ...args,
        logo: PasswordManagerLogo,
      },
      template: /* HTML */ `<bit-layout>
        <bit-side-nav>
          <bit-nav-logo [openIcon]="logo" route="." [label]="Logo"></bit-nav-logo>
          <bit-nav-group text="Password Managers" icon="bwi-collection-shared" [open]="true">
            <bit-nav-item text="Child A" route="a" icon="bwi-filter"></bit-nav-item>
            <bit-nav-item text="Child B" route="b"></bit-nav-item>
            <bit-nav-item
              text="Virtual Scroll"
              route="virtual-scroll"
              icon="bwi-filter"
            ></bit-nav-item>
          </bit-nav-group>
          <bit-nav-group text="Favorites" icon="bwi-filter">
            <bit-nav-item text="Favorites Child A" icon="bwi-filter"></bit-nav-item>
            <bit-nav-item text="Favorites Child B"></bit-nav-item>
            <bit-nav-item text="Favorites Child C" icon="bwi-filter"></bit-nav-item>
          </bit-nav-group>
        </bit-side-nav>
        <router-outlet></router-outlet>
      </bit-layout>`,
    };
  },
  parameters: {
    chromatic: {
      viewports: [640, 1280],
    },
  },
};

export const MenuOpen: Story = {
  render: Default.render,
  play: async (context) => {
    const canvas = context.canvasElement;
    const table = getByRole(canvas, "table");

    const menuButton = getAllByRole(table, "button")[0];
    await userEvent.click(menuButton);
  },
  parameters: {
    chromatic: { ignoreSelectors: [".bit-menu-panel-backdrop"] },
  },
};

export const DialogOpen: Story = {
  render: Default.render,
  play: async (context) => {
    const canvas = context.canvasElement;
    const dialogButton = getByRole(canvas, "button", {
      name: "Open Dialog",
    });

    // workaround for userEvent not firing in FF https://github.com/testing-library/user-event/issues/1075
    await fireEvent.click(dialogButton);
  },
};

export const DrawerOpen: Story = {
  render: Default.render,
  play: async (context) => {
    const canvas = context.canvasElement;
    const drawerButton = getByRole(canvas, "button", {
      name: "Open Drawer",
    });

    // workaround for userEvent not firing in FF https://github.com/testing-library/user-event/issues/1075
    await fireEvent.click(drawerButton);
  },
};

export const PopoverOpen: Story = {
  render: Default.render,
  play: async (context) => {
    const canvas = context.canvasElement;
    const popoverLink = getByRole(canvas, "button", {
      name: "Popover trigger link",
    });

    await userEvent.click(popoverLink);
  },
};

export const SimpleDialogOpen: Story = {
  render: Default.render,
  play: async (context) => {
    const canvas = context.canvasElement;
    const submitButton = getByRole(canvas, "button", {
      name: "Submit",
    });

    // workaround for userEvent not firing in FF https://github.com/testing-library/user-event/issues/1075
    await fireEvent.click(submitButton);
  },
};

export const EmptyTab: Story = {
  render: Default.render,
  play: async (context) => {
    const canvas = context.canvasElement;
    const emptyTab = getByRole(canvas, "tab", { name: "Empty tab" });
    await userEvent.click(emptyTab);
  },
};

export const VirtualScrollBlockingDialog: Story = {
  render: Default.render,
  play: async (context) => {
    const canvas = context.canvasElement;
    const navItem = getByText(canvas, "Virtual Scroll");
    await userEvent.click(navItem);

    const htmlEl = canvas.ownerDocument.documentElement;
    htmlEl.scrollTop = 2000;

    const dialogButton = getAllByLabelText(canvas, "Options")[0];

    await userEvent.click(dialogButton);
  },
};

export const ResponsiveSidebar: Story = {
  render: Default.render,
  parameters: {
    chromatic: {
      viewports: [640, 1280],
    },
  },
};
