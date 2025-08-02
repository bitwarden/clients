import { RouterTestingModule } from "@angular/router/testing";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ButtonModule } from "../button";
import { CalloutModule } from "../callout";
import { LayoutComponent } from "../layout";
import { mockLayoutI18n } from "../layout/mocks";
import { positionFixedWrapperDecorator } from "../stories/storybook-decorators";
import { TypographyModule } from "../typography";
import { I18nMockService } from "../utils";

import { DrawerBodyComponent } from "./drawer-body.component";
import { DrawerHeaderComponent } from "./drawer-header.component";
import { DrawerComponent } from "./drawer.component";
import { DrawerModule } from "./drawer.module";

export default {
  title: "Component Library/Drawer",
  component: DrawerComponent,
  subcomponents: {
    DrawerHeaderComponent,
    DrawerBodyComponent,
  },
  decorators: [
    positionFixedWrapperDecorator(),
    moduleMetadata({
      imports: [
        RouterTestingModule,
        LayoutComponent,
        DrawerModule,
        ButtonModule,
        CalloutModule,
        TypographyModule,
      ],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              ...mockLayoutI18n,
              close: "Close",
            });
          },
        },
      ],
    }),
  ],
} as Meta<DrawerComponent>;

type Story = StoryObj<DrawerComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
        <bit-layout class="tw-text-main">
            <p>The drawer is {{ open ? "open" : "closed" }}.<p>
            <button type="button" bitButton (click)="drawer.toggle()">Toggle</button>
            
            <!-- Note: bit-drawer does *not* need to be a direct descendant of bit-layout. -->
            <bit-drawer [(open)]="open" #drawer>
              <bit-drawer-header title="Hello Bitwaaaaaaaaaaaaaaaaaaaaaaaaarden!">
                <i slot="start" class="bwi bwi-key" aria-hidden="true"></i>
              </bit-drawer-header>
              <bit-drawer-body>
                <p bitTypography="body1">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                </p>
              </bit-drawer-body>
            </bit-drawer>
        </bit-layout>
    `,
  }),
  args: {
    open: true,
  },
};

export const Headless: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
        <bit-layout class="tw-text-main">
            <p>The drawer is {{ open ? "open" : "closed" }}.<p>
            <button type="button" bitButton (click)="drawer.toggle()">Toggle</button>
            <bit-drawer [(open)]="open" #drawer>
              <h2 bitTypography="h2"></h2>
              Hello world!
            </bit-drawer>
        </bit-layout>
    `,
  }),
  args: {
    open: true,
  },
};

export const MultipleDrawers: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
        <bit-layout class="tw-text-main">
            <button type="button" bitButton (click)="foo.toggle()">{{ !foo.open() ? "Open" : "Close" }} Foo</button>
            <button type="button" bitButton (click)="bar.toggle()">{{ !bar.open() ? "Open" : "Close" }} Bar</button>
            
            <bit-drawer #foo>
              Foo
            </bit-drawer>

            <bit-drawer #bar [open]="true">
              Bar
            </bit-drawer>
        </bit-layout>
    `,
  }),
};
