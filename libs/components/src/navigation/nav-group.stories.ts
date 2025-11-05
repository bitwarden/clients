import { Component, importProvidersFrom } from "@angular/core";
import { RouterModule } from "@angular/router";
import { StoryObj, Meta, moduleMetadata, applicationConfig } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { LayoutComponent } from "../layout";
import { SharedModule } from "../shared/shared.module";
import { positionFixedWrapperDecorator } from "../stories/storybook-decorators";
import { I18nMockService } from "../utils/i18n-mock.service";

import { NavGroupComponent } from "./nav-group.component";
import { NavigationModule } from "./navigation.module";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  template: "",
})
class DummyContentComponent {}

export default {
  title: "Component Library/Nav/Nav Group",
  component: NavGroupComponent,
  decorators: [
    positionFixedWrapperDecorator((story) => `<bit-layout>${story}</bit-layout>`),
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
              loading: "Loading",
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
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-40145&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta;

export const Default: StoryObj<NavGroupComponent> = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-side-nav>
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
      </bit-side-nav>
    `,
  }),
};

export const HideEmptyGroups: StoryObj<NavGroupComponent & { renderChildren: boolean }> = {
  args: {
    hideIfEmpty: true,
    renderChildren: false,
  },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-side-nav>
        <bit-nav-group text="Hello World (Anchor)" [route]="['a']" icon="bwi-filter" [hideIfEmpty]="hideIfEmpty">
          <bit-nav-item text="Child A" route="a" icon="bwi-filter" *ngIf="renderChildren"></bit-nav-item>
          <bit-nav-item text="Child B" route="b" *ngIf="renderChildren"></bit-nav-item>
          <bit-nav-item text="Child C" route="c" icon="bwi-filter" *ngIf="renderChildren"></bit-nav-item>
        </bit-nav-group>
        <bit-nav-group text="Lorem Ipsum (Button)" icon="bwi-filter">
          <bit-nav-item text="Child A" icon="bwi-filter"></bit-nav-item>
          <bit-nav-item text="Child B"></bit-nav-item>
          <bit-nav-item text="Child C" icon="bwi-filter"></bit-nav-item>
        </bit-nav-group>
      </bit-side-nav>
    `,
  }),
};

export const Secondary: StoryObj<NavGroupComponent> = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-side-nav variant="secondary">
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
      </bit-side-nav>
    `,
  }),
};
