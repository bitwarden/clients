import { Component, importProvidersFrom } from "@angular/core";
import { RouterModule } from "@angular/router";
import { StoryObj, Meta, moduleMetadata, applicationConfig } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { LayoutComponent } from "../layout";
import { SharedModule } from "../shared/shared.module";
import { I18nMockService } from "../utils/i18n-mock.service";
import { positionFixedWrapperDecorator } from "../utils/position-fixed-wrapper-decorator";

import { NavGroupComponent } from "./nav-group.component";
import { NavigationModule } from "./navigation.module";

@Component({
  standalone: true,
  template: "",
})
class DummyContentComponent {}

export default {
  title: "Component Library/Nav/Nav Group",
  component: NavGroupComponent,
  decorators: [
    positionFixedWrapperDecorator(
      (story) => `<bit-layout><bit-side-nav>${story}</bit-side-nav></bit-layout>`,
    ),
    moduleMetadata({
      imports: [
        SharedModule,
        RouterModule,
        NavigationModule,
        DummyContentComponent,
        LayoutComponent,
      ],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              submenu: "submenu",
              toggleCollapse: "toggle collapse",
              toggleSideNavigation: "Toggle side navigation",
              skipToContent: "Skip to content",
            });
          },
        },
      ],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(
          RouterModule.forRoot(
            [
              { path: "", redirectTo: "a", pathMatch: "full" },
              { path: "**", component: DummyContentComponent },
            ],
            { useHash: true },
          ),
        ),
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/file/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=4687%3A86642",
    },
    chromatic: { viewports: [640, 1280] },
  },
} as Meta;

export const Default: StoryObj<NavGroupComponent> = {
  render: (args) => ({
    props: args,
    template: `
      <bit-nav-group text="Hello World (Anchor)" [route]="['a']" icon="bwi-filter">
        <bit-nav-item text="Child A" route="a" icon="bwi-filter"></bit-nav-item>
        <bit-nav-item text="Child B" route="b"></bit-nav-item>
        <bit-nav-item text="Child C" route="c" icon="bwi-filter"></bit-nav-item>
      </bit-nav-group>
      <bit-nav-group text="Lorem Ipsum (Button)" icon="bwi-filter">
        <bit-nav-item text="Child A" icon="bwi-filter"></bit-nav-item>
        <bit-nav-item text="Child B"></bit-nav-item>
        <bit-nav-item text="Child C" icon="bwi-filter"></bit-nav-item>
      </bit-nav-group>
    `,
  }),
};

export const Tree: StoryObj<NavGroupComponent> = {
  render: (args) => ({
    props: args,
    template: `
      <bit-nav-group text="Tree example" icon="bwi-collection" [open]="true">
        <bit-nav-group text="Level 1 - with children (empty)" route="t1" icon="bwi-collection" variant="tree"></bit-nav-group>
        <bit-nav-item text="Level 1 - no children" route="t2" icon="bwi-collection" variant="tree"></bit-nav-item>
        <bit-nav-group text="Level 1 - with children" route="t3" icon="bwi-collection" variant="tree" [open]="true">
          <bit-nav-group text="Level 2 - with children" route="t4" icon="bwi-collection" variant="tree" [open]="true">
            <bit-nav-item text="Level 3 - no children, no icon" route="t5" variant="tree"></bit-nav-item>
            <bit-nav-group text="Level 3 - with children" route="t6" icon="bwi-collection" variant="tree" [open]="true">
              <bit-nav-item text="Level 4 - no children, no icon" route="t7" variant="tree"></bit-nav-item>
            </bit-nav-group>
          </bit-nav-group>
          <bit-nav-group text="Level 2 - with children (empty)" route="t8" icon="bwi-collection" variant="tree" [open]="true"></bit-nav-group>
          <bit-nav-item text="Level 2 - no children" route="t9" icon="bwi-collection" variant="tree"></bit-nav-item>
        </bit-nav-group>
        <bit-nav-item text="Level 1 - no children" route="t10" icon="bwi-collection" variant="tree"></bit-nav-item>
      </bit-nav-group>
    `,
  }),
};
