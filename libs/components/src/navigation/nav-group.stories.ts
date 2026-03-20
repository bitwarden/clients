import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, importProvidersFrom } from "@angular/core";
import { RouterModule } from "@angular/router";
import { StoryObj, Meta, moduleMetadata, applicationConfig } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { GlobalStateProvider } from "@bitwarden/state";

import { IconButtonModule } from "../icon-button";
import { LayoutComponent } from "../layout";
import { positionFixedWrapperDecorator } from "../stories/storybook-decorators";
import { I18nMockService } from "../utils/i18n-mock.service";
import { StorybookGlobalStateProvider } from "../utils/state-mock";

import { NavGroupComponent } from "./nav-group.component";
import { NavigationModule } from "./navigation.module";

@Component({
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class DummyContentComponent {}

export default {
  title: "Component Library/Nav/Nav Group",
  component: NavGroupComponent,
  decorators: [
    positionFixedWrapperDecorator((story) => `<bit-layout>${story}</bit-layout>`),
    moduleMetadata({
      imports: [
        CommonModule,
        RouterModule,
        NavigationModule,
        DummyContentComponent,
        LayoutComponent,
        IconButtonModule,
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
              resizeSideNavigation: "Resize side navigation",
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
        {
          provide: GlobalStateProvider,
          useClass: StorybookGlobalStateProvider,
        },
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
        <bit-nav-group text="Hello World (Anchor)" [route]="['a']" icon="bwi-grid">
          <bit-nav-item text="Child A" route="a" icon="bwi-grid"></bit-nav-item>
          <bit-nav-item text="Child B" route="b"></bit-nav-item>
          <bit-nav-item text="Child C" route="c" icon="bwi-grid"></bit-nav-item>
        </bit-nav-group>
        <bit-nav-group text="Lorem Ipsum (Button)" icon="bwi-grid">
          <bit-nav-item text="Child A" icon="bwi-grid"></bit-nav-item>
          <bit-nav-item text="Child B"></bit-nav-item>
          <bit-nav-item text="Child C" icon="bwi-grid"></bit-nav-item>
        </bit-nav-group>
        <bit-nav-group open="true" text="Lorem Ipsum (Button)" icon="bwi-grid">
          <bit-nav-item text="Child A" icon="bwi-grid"></bit-nav-item>
          <bit-nav-item text="Child B"></bit-nav-item>
          <bit-nav-item text="Child C" icon="bwi-grid"></bit-nav-item>
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
        <bit-nav-group text="Hello World (Anchor)" [route]="['a']" icon="bwi-grid" [hideIfEmpty]="hideIfEmpty">
          <bit-nav-item text="Child A" route="a" icon="bwi-grid" *ngIf="renderChildren"></bit-nav-item>
          <bit-nav-item text="Child B" route="b" *ngIf="renderChildren"></bit-nav-item>
          <bit-nav-item text="Child C" route="c" icon="bwi-grid" *ngIf="renderChildren"></bit-nav-item>
        </bit-nav-group>
        <bit-nav-group text="Lorem Ipsum (Button)" icon="bwi-grid">
          <bit-nav-item text="Child A" icon="bwi-grid"></bit-nav-item>
          <bit-nav-item text="Child B"></bit-nav-item>
          <bit-nav-item text="Child C" icon="bwi-grid"></bit-nav-item>
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
        <bit-nav-group text="Hello World (Anchor)" [route]="['a']" icon="bwi-grid">
          <bit-nav-item text="Child A" route="a" icon="bwi-grid"></bit-nav-item>
          <bit-nav-item text="Child B" route="b"></bit-nav-item>
          <bit-nav-item text="Child C" route="c" icon="bwi-grid"></bit-nav-item>
        </bit-nav-group>
        <bit-nav-group text="Lorem Ipsum (Button)" icon="bwi-grid">
          <bit-nav-item text="Child A" icon="bwi-grid"></bit-nav-item>
          <bit-nav-item text="Child B"></bit-nav-item>
          <bit-nav-item text="Child C" icon="bwi-grid"></bit-nav-item>
        </bit-nav-group>
      </bit-side-nav>
    `,
  }),
};

export const NestedGroups: StoryObj<NavGroupComponent> = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-side-nav>
        <bit-nav-group text="Nested groups example" icon="bwi-collection" [open]="true">
          <bit-nav-item text="Level 1 - no children" route="t2" icon="bwi-collection"></bit-nav-item>
          <bit-nav-group text="Level 1 - with children" route="t3" icon="bwi-collection" [open]="true">
            <bit-nav-group text="Level 2 - with children" route="t4" icon="bwi-collection" [open]="true">
              <bit-nav-item text="Level 3 - no children, no icon" route="t5"></bit-nav-item>
              <bit-nav-group text="Level 3 - with children" route="t6" icon="bwi-collection" [open]="true">
                <bit-nav-item text="Level 4 - no children, no icon" route="t7"></bit-nav-item>
                <bit-nav-group text="Level 4 - with children" route="t8" icon="bwi-collection" [open]="true">
                  <bit-nav-item text="Level 5 - no children, no icon" route="t9"></bit-nav-item>
                </bit-nav-group>
              </bit-nav-group>
            </bit-nav-group>
          </bit-nav-group>
        </bit-nav-group>
      </bit-side-nav>
    `,
  }),
};

export const ForcedActive: StoryObj<NavGroupComponent> = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-side-nav>
        <bit-nav-group text="Hello World (Anchor)" [route]="['a']" icon="bwi-grid" [hideIfEmpty]="hideIfEmpty">
          <bit-nav-item text="Child A" route="a" icon="bwi-grid" *ngIf="renderChildren"></bit-nav-item>
          <bit-nav-item text="Child B" route="b" *ngIf="renderChildren"></bit-nav-item>
          <bit-nav-item text="Child C" route="c" icon="bwi-grid" *ngIf="renderChildren"></bit-nav-item>
        </bit-nav-group>
        <bit-nav-group text="Lorem Ipsum (Button)" icon="bwi-grid" forceActiveStyles disableToggleOnClick>
          <bit-nav-item text="Child A" icon="bwi-grid"></bit-nav-item>
          <bit-nav-item text="Child B"></bit-nav-item>
          <bit-nav-item text="Child C" icon="bwi-grid"></bit-nav-item>
        </bit-nav-group>
      </bit-side-nav>
    `,
  }),
};

export const WithTrailingElements: StoryObj<NavGroupComponent> = {
  render: (args) => ({
    props: {
      ...args,
      handleEditClick: () => alert("Edit button clicked!"),
    },
    template: /*html*/ `
      <bit-side-nav>
        <bit-nav-group text="With Interactive Element" [route]="['a']" icon="bwi-filter">
          <bit-nav-item text="Child A" route="a"></bit-nav-item>
          <bit-nav-item text="Child B" route="b"></bit-nav-item>
          <bit-nav-item text="Child C" route="c"></bit-nav-item>
          <button
            type="button"
            slot="end"
            class="tw-ms-auto"
            bitIconButton="bwi-edit"
            buttonType="side-nav"
            size="xsmall"
            label="Edit"
            (click)="handleEditClick()"
          ></button>
        </bit-nav-group>
        <bit-nav-group text="With Trailing Text" [route]="['aa']" icon="bwi-filter">
          <bit-nav-item text="Child A" route="aa"></bit-nav-item>
          <bit-nav-item text="Child B" route="bb"></bit-nav-item>
          <bit-nav-item text="Child C" route="cc"></bit-nav-item>
          <span slot="end"> 12 </span>
        </bit-nav-group>
      </bit-side-nav>
    `,
  }),
};
