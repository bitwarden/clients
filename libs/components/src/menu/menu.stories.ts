import { OverlayModule } from "@angular/cdk/overlay";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BerryComponent } from "../berry";
import { ButtonModule } from "../button";
import { IconModule } from "../icon";
import { I18nMockService } from "../utils";

import { MenuTriggerForDirective } from "./menu-trigger-for.directive";
import { MenuModule } from "./menu.module";

export default {
  title: "Component Library/Menu",
  component: MenuTriggerForDirective,
  decorators: [
    moduleMetadata({
      imports: [MenuModule, OverlayModule, ButtonModule, IconModule, BerryComponent],
      providers: [
        {
          provide: I18nService,
          useValue: new I18nMockService({ loading: "Loading" }),
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-40144&t=b5tDKylm5sWm2yKo-11",
    },
  },
} as Meta;

type Story = StoryObj<MenuTriggerForDirective>;

const DefaultMenuTemplate = `
  <bit-menu #myMenu>
    <a href="#" bitMenuItem>Anchor link</a>
    <a href="#" bitMenuItem>Another link</a>
    <button type="button" bitMenuItem>Button</button>
    <button type="button" bitMenuItem variant="danger">
      Danger button
    </button>
    <bit-menu-divider></bit-menu-divider>
    <button type="button" bitMenuItem>
      <bit-icon name="bwi-key" slot="start" />
      Button with icons
      <bit-icon name="bwi-angle-right" slot="end" />
    </button>
    <button type="button" bitMenuItem variant="danger">
      <bit-icon name="bwi-trash" slot="start" />
      Danger button with icon
    </button>
    <button type="button" bitMenuItem disabled>
      <bit-icon name="bwi-clone" slot="start" />
      Disabled button
    </button>
  </bit-menu>
`;

export const OpenMenu: Story = {
  render: () => ({
    template: /*html*/ `
      <div class="tw-h-72">
        <div class="cdk-overlay-pane bit-menu-panel">
          <ng-container *ngTemplateOutlet="myMenu.templateRef()"></ng-container>
        </div>
      </div>
      ${DefaultMenuTemplate}
      `,
  }),
};

export const ClosedMenu: Story = {
  render: () => ({
    template: /*html*/ `
      <div class="tw-h-80">
        <button type="button" bitButton buttonType="secondary" [bitMenuTriggerFor]="myMenu">Open menu</button>
      </div>
      ${DefaultMenuTemplate}
      `,
  }),
};

export const ActionMenu: Story = {
  render: () => ({
    template: /*html*/ `
      <bit-menu #myMenu="menuComponent">
        <button type="button" bitMenuItem>
          <bit-icon name="bwi-globe" slot="start" />
          Login
        </button>
        <button type="button" bitMenuItem>
          <bit-icon name="bwi-credit-card" slot="start" />
          Card
        </button>
        <button type="button" bitMenuItem>
          <bit-icon name="bwi-id-card" slot="start" />
          Identity
        </button>
        <button type="button" bitMenuItem>
          <bit-icon name="bwi-sticky-note" slot="start" />
          Note
        </button>
        <button type="button" bitMenuItem>
          <bit-icon name="bwi-key" slot="start" />
          SSH Key
        </button>
        <bit-menu-divider></bit-menu-divider>
        <button type="button" bitMenuItem>
          <bit-icon name="bwi-folder" slot="start" />
          Folder
        </button>
        <button type="button" bitMenuItem>
          <bit-icon name="bwi-collection" slot="start" />
          Collection
        </button>
      </bit-menu>

      <bit-menu #noIconsMenu="menuComponent">
        <button type="button" bitMenuItem>
          Autofill
        </button>
        <button type="button" bitMenuItem>
          Favorite
        </button>
        <button type="button" bitMenuItem>
          Edit
        </button>
        <button type="button" bitMenuItem>
          Clone
        </button>
        <button type="button" bitMenuItem>
          Assign to collections
        </button>
        <bit-menu-divider></bit-menu-divider>
        <button type="button" bitMenuItem variant="danger">
          Delete
        </button>
      </bit-menu>

      <div class="tw-flex tw-gap-4">
        <div class="tw-w-[200px]">
          <ng-container *ngTemplateOutlet="myMenu.templateRef()"></ng-container>
        </div>
        <div class="tw-w-[200px]">
          <ng-container *ngTemplateOutlet="noIconsMenu.templateRef()"></ng-container>
        </div>
      </div>
      `,
  }),
};
