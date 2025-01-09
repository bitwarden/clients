import { RouterTestingModule } from "@angular/router/testing";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { userEvent } from "@storybook/test";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { CalloutModule } from "../callout";
import { NavigationModule } from "../navigation";
import { I18nMockService } from "../utils/i18n-mock.service";
import { positionFixedWrapperDecorator } from "../utils/position-fixed-wrapper-decorator";

import { LayoutComponent } from "./layout.component";

export default {
  title: "Component Library/Layout",
  component: LayoutComponent,
  decorators: [
    positionFixedWrapperDecorator(),
    moduleMetadata({
      imports: [NavigationModule, RouterTestingModule, CalloutModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              toggleSideNavigation: "Toggle side navigation",
              skipToContent: "Skip to content",
              submenu: "submenu",
              toggleCollapse: "toggle collapse",
            });
          },
        },
      ],
    }),
  ],
  parameters: {
    chromatic: { viewports: [640, 1280] },
  },
} as Meta;

type Story = StoryObj<LayoutComponent>;

export const Empty: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `<bit-layout>
      <bit-side-nav></bit-side-nav>
    </bit-layout>`,
  }),
};

export const WithContent: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <bit-layout>
        <bit-side-nav>
          <bit-nav-item text="Item A" route="#" icon="bwi-lock"></bit-nav-item>
          <bit-nav-group text="Tree A" icon="bwi-family" [open]="true">
            <bit-nav-group
              text="Level 1 - with children (empty)"
              route="#"
              icon="bwi-collection"
              variant="tree"
            ></bit-nav-group>
            <bit-nav-item
              text="Level 1 - no children"
              route="#"
              icon="bwi-collection"
              variant="tree"
            ></bit-nav-item>
            <bit-nav-group
              text="Level 1 - with children"
              route="#"
              icon="bwi-collection"
              variant="tree"
              [open]="true"
            >
              <bit-nav-group
                text="Level 2 - with children"
                route="#"
                icon="bwi-collection"
                variant="tree"
                [open]="true"
              >
                <bit-nav-item
                  text="Level 3 - no children, no icon"
                  route="#"
                  variant="tree"
                ></bit-nav-item>
                <bit-nav-group
                  text="Level 3 - with children"
                  route="#"
                  icon="bwi-collection"
                  variant="tree"
                  [open]="true"
                >
                  <bit-nav-item
                    text="Level 4 - no children, no icon"
                    route="#"
                    variant="tree"
                  ></bit-nav-item>
                </bit-nav-group>
              </bit-nav-group>
              <bit-nav-group
                text="Level 2 - with children (empty)"
                route="#"
                icon="bwi-collection"
                variant="tree"
                [open]="true"
              ></bit-nav-group>
              <bit-nav-item
                text="Level 2 - no children"
                route="#"
                icon="bwi-collection"
                variant="tree"
              ></bit-nav-item>
            </bit-nav-group>
            <bit-nav-item
              text="Level 1 - no children"
              route="#"
              icon="bwi-collection"
              variant="tree"
            ></bit-nav-item>
          </bit-nav-group>
          <bit-nav-group text="Tree B" icon="bwi-collection" [open]="true">
            <bit-nav-group
              text="Level 1 - with children (empty)"
              route="#"
              icon="bwi-collection"
              variant="tree"
            ></bit-nav-group>
            <bit-nav-item
              text="Level 1 - no children"
              route="#"
              icon="bwi-collection"
              variant="tree"
            ></bit-nav-item>
            <bit-nav-group
              text="Level 1 - with children"
              route="#"
              icon="bwi-collection"
              variant="tree"
              [open]="true"
            >
              <bit-nav-group
                text="Level 2 - with children"
                route="#"
                icon="bwi-collection"
                variant="tree"
                [open]="true"
              >
                <bit-nav-item
                  text="Level 3 - no children, no icon"
                  route="#"
                  variant="tree"
                ></bit-nav-item>
                <bit-nav-group
                  text="Level 3 - with children"
                  route="#"
                  icon="bwi-collection"
                  variant="tree"
                  [open]="true"
                >
                  <bit-nav-item
                    text="Level 4 - no children, no icon"
                    route="#"
                    variant="tree"
                  ></bit-nav-item>
                </bit-nav-group>
              </bit-nav-group>
              <bit-nav-group
                text="Level 2 - with children (empty)"
                route="#"
                icon="bwi-collection"
                variant="tree"
                [open]="true"
              ></bit-nav-group>
              <bit-nav-item
                text="Level 2 - no children"
                route="#"
                icon="bwi-collection"
                variant="tree"
              ></bit-nav-item>
            </bit-nav-group>
            <bit-nav-item
              text="Level 1 - no children"
              route="#"
              icon="bwi-collection"
              variant="tree"
            ></bit-nav-item>
          </bit-nav-group>
          <bit-nav-group text="Tree C" icon="bwi-key" [open]="true">
            <bit-nav-group
              text="Level 1 - with children (empty)"
              route="#"
              icon="bwi-collection"
              variant="tree"
            ></bit-nav-group>
            <bit-nav-item
              text="Level 1 - no children"
              route="#"
              icon="bwi-collection"
              variant="tree"
            ></bit-nav-item>
            <bit-nav-group
              text="Level 1 - with children"
              route="#"
              icon="bwi-collection"
              variant="tree"
              [open]="true"
            >
              <bit-nav-group
                text="Level 2 - with children"
                route="#"
                icon="bwi-collection"
                variant="tree"
                [open]="true"
              >
                <bit-nav-item
                  text="Level 3 - no children, no icon"
                  route="#"
                  variant="tree"
                ></bit-nav-item>
                <bit-nav-group
                  text="Level 3 - with children"
                  route="#"
                  icon="bwi-collection"
                  variant="tree"
                  [open]="true"
                >
                  <bit-nav-item
                    text="Level 4 - no children, no icon"
                    route="#"
                    variant="tree"
                  ></bit-nav-item>
                </bit-nav-group>
              </bit-nav-group>
              <bit-nav-group
                text="Level 2 - with children (empty)"
                route="#"
                icon="bwi-collection"
                variant="tree"
                [open]="true"
              ></bit-nav-group>
              <bit-nav-item
                text="Level 2 - no children"
                route="#"
                icon="bwi-collection"
                variant="tree"
              ></bit-nav-item>
            </bit-nav-group>
            <bit-nav-item
              text="Level 1 - no children"
              route="#"
              icon="bwi-collection"
              variant="tree"
            ></bit-nav-item>
          </bit-nav-group>
        </bit-side-nav>
        <bit-callout title="Foobar"> Hello world! </bit-callout>
      </bit-layout>
    `,
  }),
};

export const SkipLinks: Story = {
  ...WithContent,
  play: async () => {
    await userEvent.tab();
  },
};

export const Secondary: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <bit-layout>
        <bit-side-nav variant="secondary">
          <bit-nav-item text="Item A" icon="bwi-collection"></bit-nav-item>
          <bit-nav-item text="Item B" icon="bwi-collection"></bit-nav-item>
          <bit-nav-divider></bit-nav-divider>
          <bit-nav-item text="Item C" icon="bwi-collection"></bit-nav-item>
          <bit-nav-item text="Item D" icon="bwi-collection"></bit-nav-item>
          <bit-nav-group text="Tree example" icon="bwi-collection" [open]="true">
            <bit-nav-group
              text="Level 1 - with children (empty)"
              route="#"
              icon="bwi-collection"
              variant="tree"
            ></bit-nav-group>
            <bit-nav-item
              text="Level 1 - no children"
              route="#"
              icon="bwi-collection"
              variant="tree"
            ></bit-nav-item>
            <bit-nav-group
              text="Level 1 - with children"
              route="#"
              icon="bwi-collection"
              variant="tree"
              [open]="true"
            >
              <bit-nav-group
                text="Level 2 - with children"
                route="#"
                icon="bwi-collection"
                variant="tree"
                [open]="true"
              >
                <bit-nav-item
                  text="Level 3 - no children, no icon"
                  route="#"
                  variant="tree"
                ></bit-nav-item>
                <bit-nav-group
                  text="Level 3 - with children"
                  route="#"
                  icon="bwi-collection"
                  variant="tree"
                  [open]="true"
                >
                  <bit-nav-item
                    text="Level 4 - no children, no icon"
                    route="#"
                    variant="tree"
                  ></bit-nav-item>
                </bit-nav-group>
              </bit-nav-group>
              <bit-nav-group
                text="Level 2 - with children (empty)"
                route="#"
                icon="bwi-collection"
                variant="tree"
                [open]="true"
              ></bit-nav-group>
              <bit-nav-item
                text="Level 2 - no children"
                route="#"
                icon="bwi-collection"
                variant="tree"
              ></bit-nav-item>
            </bit-nav-group>
            <bit-nav-item
              text="Level 1 - no children"
              route="#"
              icon="bwi-collection"
              variant="tree"
            ></bit-nav-item>
          </bit-nav-group>
        </bit-side-nav>
        <bit-callout title="Foobar"> Hello world! </bit-callout>
      </bit-layout>
    `,
  }),
};
