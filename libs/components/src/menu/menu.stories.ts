import { OverlayModule } from "@angular/cdk/overlay";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { ButtonModule } from "../button/button.module";

import { MenuDividerComponent } from "./menu-divider.component";
import { MenuItemDirective } from "./menu-item.directive";
import { MenuTriggerForDirective } from "./menu-trigger-for.directive";
import { MenuComponent } from "./menu.component";

export default {
  title: "Component Library/Menu",
  component: MenuTriggerForDirective,
  decorators: [
    moduleMetadata({
      declarations: [
        MenuTriggerForDirective,
        MenuComponent,
        MenuItemDirective,
        MenuDividerComponent,
      ],
      imports: [OverlayModule, ButtonModule],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/file/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=1881%3A17952",
    },
  },
} as Meta;

type Story = StoryObj<MenuTriggerForDirective>;

export const OpenMenu: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-menu #myMenu="menuComponent">
        <a href="#" bitMenuItem>Anchor link</a>
        <a href="#" bitMenuItem>Another link</a>
        <button type="button" bitMenuItem>Button</button>
        <bit-menu-divider></bit-menu-divider>
        <button type="button" bitMenuItem>
          <i class="bwi bwi-key" slot="start"></i>
          Button with icons
          <i class="bwi bwi-angle-right" slot="end"></i>
        </button>
        <button type="button" bitMenuItem disabled>
          <i class="bwi bwi-clone" slot="start"></i>
          Disabled button
        </button>
      </bit-menu>
  
      <div class="tw-h-40">
        <div class="cdk-overlay-pane bit-menu-panel">
          <ng-container *ngTemplateOutlet="myMenu.templateRef"></ng-container>
        </div>
      </div>
      `,
  }),
};
export const ClosedMenu: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-h-40">
        <button bitButton buttonType="secondary" [bitMenuTriggerFor]="myMenu">Open menu</button>
      </div>
  
      <bit-menu #myMenu>
        <a href="#" bitMenuItem>Anchor link</a>
        <a href="#" bitMenuItem>Another link</a>
        <button type="button" bitMenuItem>Button</button>
        <bit-menu-divider></bit-menu-divider>
        <button type="button" bitMenuItem>
          <i class="bwi bwi-key" slot="start"></i>
          Button with icons
          <i class="bwi bwi-angle-right" slot="end"></i>
        </button>
        <button type="button" bitMenuItem disabled>
          <i class="bwi bwi-clone" slot="start"></i>
          Disabled button
        </button>
      </bit-menu>`,
  }),
};

export const ManyItems: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-h-40">
        <button bitButton buttonType="secondary" [bitMenuTriggerFor]="myMenu">Open menu</button>
      </div>
  
      <bit-menu #myMenu>
        ${`<a href="#" bitMenuItem>Foobar</a>`.repeat(100)}
      </bit-menu>`,
  }),
};
