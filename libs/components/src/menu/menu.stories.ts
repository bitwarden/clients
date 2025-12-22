import { OverlayModule } from "@angular/cdk/overlay";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ButtonModule } from "../button/button.module";
import { I18nMockService } from "../utils";

import { MenuTriggerForDirective } from "./menu-trigger-for.directive";
import { MenuModule } from "./menu.module";

export default {
  title: "Component Library/Menu",
  component: MenuTriggerForDirective,
  decorators: [
    moduleMetadata({
      imports: [MenuModule, OverlayModule, ButtonModule],
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
          <ng-container *ngTemplateOutlet="myMenu.templateRef()"></ng-container>
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
        <button type="button" bitButton buttonType="secondary" [bitMenuTriggerFor]="myMenu">Open menu</button>
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
