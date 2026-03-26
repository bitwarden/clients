import { OverlayModule } from "@angular/cdk/overlay";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BerryComponent } from "../berry";
import { ButtonModule } from "../button";
import { IconModule } from "../icon";
import { I18nMockService } from "../utils";

import { FilterMenuHeaderComponent } from "./filter-menu-header.component";
import { MenuTriggerForDirective } from "./menu-trigger-for.directive";
import { MenuModule } from "./menu.module";

export default {
  title: "Component Library/Menu",
  component: MenuTriggerForDirective,
  decorators: [
    moduleMetadata({
      imports: [
        MenuModule,
        OverlayModule,
        ButtonModule,
        IconModule,
        FilterMenuHeaderComponent,
        BerryComponent,
      ],
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
        <div class="bit-menu-panel tw-w-[200px]">
          <ng-container *ngTemplateOutlet="myMenu.templateRef()"></ng-container>
        </div>
        <div class="bit-menu-panel tw-w-[200px]">
          <ng-container *ngTemplateOutlet="noIconsMenu.templateRef()"></ng-container>
        </div>
      </div>
      `,
  }),
};

export const InputMenu: Story = {
  render: () => ({
    template: /*html*/ `
      <bit-menu #inputMenu="menuComponent">
        <button type="button" bitMenuItem [selectable]="true">
          Text
        </button>
        <button type="button" bitMenuItem [selectable]="true">
          Hidden
        </button>
        <button type="button" bitMenuItem [selectable]="true">
          Checkbox
        </button>
        <button type="button" bitMenuItem [selectable]="true">
          Linked
        </button>
      </bit-menu>

      <div class="bit-menu-panel tw-w-[200px]">
        <ng-container *ngTemplateOutlet="inputMenu.templateRef()"></ng-container>
      </div>
      `,
  }),
};

export const FilterMenu: Story = {
  render: () => ({
    template: /*html*/ `
      <bit-menu #filterMenu="menuComponent">
        <span slot="header"> Filters </span>

        <bit-filter-menu-header [bitMenuTriggerFor]="statusMenu">
          <span slot="title"> Status </span>
        </bit-filter-menu-header>
        
        <button type="button" bitMenuItem>
          <input type="radio" bitRadio slot="start" class="!tw-p-1" />
          Approved
          <span slot="end"> 100 </span>
        </button>
        <button type="button" bitMenuItem>
          <input type="radio" bitRadio slot="start" class="!tw-p-1" />
          Pending approval
          <span slot="end"> 10 </span>
        </button>
        <button type="button" bitMenuItem>
          <input type="radio" bitRadio slot="start" class="!tw-p-1" />
          Invited
          <span slot="end"> 15 </span>
        </button>
        <button type="button" bitMenuItem>
          <input type="radio" bitRadio slot="start" class="!tw-p-1" />
          Revoked
          <span slot="end"> 2 </span>
        </button>

        <bit-menu-divider></bit-menu-divider>

        <bit-filter-menu-header>
          <span slot="title"> Groups </span>
          <bit-berry [value]="1" slot="end"></bit-berry>
        </bit-filter-menu-header>

        <button type="button" bitMenuItem>
          <input type="checkbox" bitCheckbox slot="start" />
          Leadership
          <span slot="end"> (456) </span>
        </button>
        <button type="button" bitMenuItem>
          <input type="checkbox" bitCheckbox slot="start" />
          Engineering
          <span slot="end"> (456) </span>
        </button>
        <button type="button" bitMenuItem>
          <input type="checkbox" bitCheckbox slot="start" />
          Design
          <span slot="end"> (456) </span>
        </button>
        <button type="button" bitMenuItem>
          <input type="checkbox" bitCheckbox slot="start" />
          Marketing
          <span slot="end"> (456) </span>
        </button>
        <button type="button" bitMenuItem>
          <input type="checkbox" bitCheckbox slot="start" />
          Sales
          <span slot="end"> (456) </span>
        </button>

        <button bitButton buttonType="secondary" slot="footer" class="tw-w-[118px]">
          Clear
        </button>
        <button bitButton buttonType="primary" slot="footer" class="tw-w-[118px]">
          Apply
        </button>
      </bit-menu>

      <div class="bit-menu-panel tw-w-[280px]">
        <ng-container *ngTemplateOutlet="filterMenu.templateRef()"></ng-container>
      </div>
      `,
  }),
};

export const NestedMenu: Story = {
  render: () => ({
    template: /*html*/ `
      <bit-menu #filterMenu="menuComponent">
        <button type="button" bitMenuItem>
            Parent item
            <span slot="end"> (456) </span>
            <bit-icon name="bwi-angle-right" slot="end" />
        </button>
        <button type="button" bitMenuItem>
            <bit-icon name="bwi-angle-left" slot="start" />
            Back to parent item
            <span slot="end"> (456) </span>
        </button>
        <button type="button" bitMenuItem [selectable]="true">
            Child item
            <span slot="end"> (456) </span>
        </button>
      </bit-menu>

      <div class="bit-menu-panel tw-w-[200px]">
        <ng-container *ngTemplateOutlet="filterMenu.templateRef()"></ng-container>
      </div>
      `,
  }),
};
