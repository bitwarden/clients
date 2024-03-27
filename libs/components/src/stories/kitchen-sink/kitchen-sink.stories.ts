import { importProvidersFrom } from "@angular/core";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { RouterModule } from "@angular/router";
import {
  Meta,
  StoryObj,
  applicationConfig,
  componentWrapperDecorator,
  moduleMetadata,
} from "@storybook/angular";
import {
  userEvent,
  getAllByRole,
  getByRole,
  getByLabelText,
  fireEvent,
} from "@storybook/testing-library";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { DialogService } from "../../dialog";
import { LayoutComponent } from "../../layout";
import { I18nMockService } from "../../utils/i18n-mock.service";

import { KitchenSinkForm } from "./components/kitchen-sink-form.component";
import { KitchenSinkMainComponent } from "./components/kitchen-sink-main.component";
import { KitchenSinkTable } from "./components/kitchen-sink-table.component";
import { KitchenSinkToggleList } from "./components/kitchen-sink-toggle-list.component";
import { KitchenSinkSharedModule } from "./kitchen-sink-shared.module";

export default {
  title: "Documentation / Kitchen Sink",
  component: LayoutComponent,
  decorators: [
    componentWrapperDecorator(
      /**
       * Applying a CSS transform makes a `position: fixed` element act like it is `position: relative`
       * https://github.com/storybookjs/storybook/issues/8011#issue-490251969
       */
      (story) => {
        return /* HTML */ `<div class="tw-scale-100 tw-border-2 tw-border-solid tw-border-[red]">
          ${story}
        </div>`;
      },
      ({ globals }) => {
        /**
         * avoid a bug with the way that we render the same component twice in the same iframe and how
         * that interacts with the router-outlet
         */
        const themeOverride = globals["theme"] === "both" ? "light" : globals["theme"];
        return { theme: themeOverride };
      },
    ),
    moduleMetadata({
      imports: [
        KitchenSinkSharedModule,
        KitchenSinkForm,
        KitchenSinkMainComponent,
        KitchenSinkTable,
        KitchenSinkToggleList,
      ],
      providers: [
        DialogService,
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              close: "Close",
              search: "Search",
              skipToContent: "Skip to content",
              submenu: "submenu",
              toggleCollapse: "toggle collapse",
            });
          },
        },
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
            ],
            { useHash: true },
          ),
        ),
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<LayoutComponent>;

export const Default: Story = {
  render: (args) => {
    return {
      props: args,
      template: /* HTML */ `<bit-layout>
        <nav slot="sidebar">
          <bit-nav-group text="Password Managers" icon="bwi-collection" [open]="true">
            <bit-nav-group text="Favorites" icon="bwi-collection" variant="tree" [open]="true">
              <bit-nav-item text="Bitwarden" route="bitwarden"></bit-nav-item>
              <bit-nav-divider></bit-nav-divider>
            </bit-nav-group>
          </bit-nav-group>
        </nav>
        <router-outlet></router-outlet>
      </bit-layout>`,
    };
  },
};

export const MenuOpen: Story = {
  ...Default,
  play: async (context) => {
    const canvas = context.canvasElement;
    const table = getByRole(canvas, "table");

    const menuButton = getAllByRole(table, "button")[0];
    await userEvent.click(menuButton);
  },
};

export const DefaultDialogOpen: Story = {
  ...Default,
  play: (context) => {
    const canvas = context.canvasElement;
    const dialogButton = getByRole(canvas, "button", {
      name: "Open Dialog",
    });

    // workaround for userEvent not firing in FF https://github.com/testing-library/user-event/issues/1075
    fireEvent.click(dialogButton);
  },
};

export const PopoverOpen: Story = {
  ...Default,
  play: async (context) => {
    const canvas = context.canvasElement;
    const passwordLabelIcon = getByLabelText(canvas, "A random password (required)", {
      selector: "button",
    });

    await userEvent.click(passwordLabelIcon);
  },
};

export const SimpleDialogOpen: Story = {
  ...Default,
  play: (context) => {
    const canvas = context.canvasElement;
    const submitButton = getByRole(canvas, "button", {
      name: "Submit",
    });

    // workaround for userEvent not firing in FF https://github.com/testing-library/user-event/issues/1075
    fireEvent.click(submitButton);
  },
};

export const EmptyTab: Story = {
  ...Default,
  play: async (context) => {
    const canvas = context.canvasElement;
    const emptyTab = getByRole(canvas, "tab", { name: "Empty tab" });
    await userEvent.click(emptyTab);
  },
};
