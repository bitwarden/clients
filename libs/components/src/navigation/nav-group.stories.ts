import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, importProvidersFrom } from "@angular/core";
import { RouterModule } from "@angular/router";
import { StoryObj, Meta, moduleMetadata, applicationConfig } from "@storybook/angular";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { GlobalStateProvider } from "@bitwarden/state";
import { enabledFlags } from "@bitwarden/storybook";

import { BerryComponent } from "../berry";
import { ChipActionComponent } from "../chips";
import { IconButtonModule } from "../icon-button";
import { IconTileComponent } from "../icon-tile";
import { LayoutComponent } from "../layout";
import { positionFixedWrapperDecorator } from "../stories/storybook-decorators";
import { I18nMockService } from "../utils/i18n-mock.service";
import { StorybookGlobalStateProvider } from "../utils/state-mock";

import { NavGroupComponent } from "./nav-group.component";
import { FVW_RING_CLASSES } from "./nav-item.component";
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
        BerryComponent,
        ChipActionComponent,
        IconTileComponent,
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
              sideNavigation: "Side navigation",
              skipLink: "Skip link",
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

export const DefaultVfo1: StoryObj<NavGroupComponent> = {
  ...Default,
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
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
    props: {
      ...args,
      handleEditClick: () => alert("Edit button clicked!"),
    },
    template: /*html*/ `
      <bit-side-nav variant="secondary">
        <bit-nav-group text="Hello World (Anchor)" [route]="['a']" icon="bwi-grid">
          <bit-nav-item text="Child A" route="a" icon="bwi-grid"></bit-nav-item>
          <bit-nav-item text="Child B" route="b"></bit-nav-item>
          <bit-nav-item text="Child C" route="c" icon="bwi-grid"></bit-nav-item>
          <button
            type="button"
            slot="end"
            class="tw-ms-auto"
            bitIconButton="bwi-pencil-square"
            buttonType="side-nav"
            size="xsmall"
            label="Edit"
            (click)="handleEditClick()"
          ></button>
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

export const SecondaryVfo1: StoryObj<NavGroupComponent> = {
  ...Secondary,
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
};

export const NestedGroups: StoryObj<NavGroupComponent> = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-side-nav>
        <bit-nav-group text="Nested groups example" icon="bwi-collection-shared" [open]="true">
          <bit-nav-item text="Level 1 - no children" route="t2" icon="bwi-collection-shared"></bit-nav-item>
          <bit-nav-group text="Level 1 - with children" route="t3" icon="bwi-collection-shared" [open]="true">
            <bit-nav-group text="Level 2 - with children" route="t4" icon="bwi-collection-shared" [open]="true">
              <bit-nav-item text="Level 3 - no children, no icon" route="t5"></bit-nav-item>
              <bit-nav-group text="Level 3 - with children" route="t6" icon="bwi-collection-shared" [open]="true">
                <bit-nav-item text="Level 4 - no children, no icon" route="t7"></bit-nav-item>
                <bit-nav-group text="Level 4 - with children" route="t8" icon="bwi-collection-shared" [open]="true">
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
        <bit-nav-group text="With Nav Button" [route]="['a']" icon="bwi-filter">
          <bit-nav-item text="Child A" route="aa"></bit-nav-item>
          <bit-nav-item text="Child B" route="ab"></bit-nav-item>
          <button
            type="button"
            slot="end"
            class="tw-ms-auto"
            bitIconButton="bwi-pencil-square"
            buttonType="side-nav"
            size="xsmall"
            label="Edit"
            (click)="handleEditClick()"
          ></button>
        </bit-nav-group>
        <bit-nav-group text="With Chip" [route]="['d']" icon="bwi-filter">
          <bit-nav-item text="Child A" route="da"></bit-nav-item>
          <bit-nav-item text="Child B" route="db"></bit-nav-item>
          <button slot="end" bit-chip-action startIcon="bwi-diamond" label="Premium" size="small"></button>
        </bit-nav-group>
        <bit-nav-group text="With Berry" [route]="['e']" icon="bwi-filter">
          <bit-nav-item text="Child A" route="ea"></bit-nav-item>
          <bit-nav-item text="Child B" route="eb"></bit-nav-item>
          <bit-berry slot="end" variant="danger" [value]="1" />
        </bit-nav-group>
        <bit-nav-group text="With Text" [route]="['f']" icon="bwi-filter">
          <bit-nav-item text="Child A" route="fa"></bit-nav-item>
          <bit-nav-item text="Child B" route="fb"></bit-nav-item>
          <span slot="end"> 12 </span>
        </bit-nav-group>
      </bit-side-nav>
    `,
  }),
};

/**
 * A `bit-icon-tile` projected into a top-level nav group becomes its leading glyph — no `slot`
 * attribute needed, the tile is matched by its own selector. (Other leading content still uses
 * `slot="start"`.) This is only available for v2 top-level groups (this story enables the
 * VFO1Foundation flag) — the collapse toggle owns the leading position for v1 groups and v2
 * nested groups.
 */
export const WithStartSlot: StoryObj<NavGroupComponent> = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-side-nav>
        <bit-nav-group text="With Icon Tile" [route]="['a']">
          <bit-icon-tile icon="bwi-star" variant="primary" size="sm"></bit-icon-tile>
          <bit-nav-item text="Child A" route="aa"></bit-nav-item>
          <bit-nav-item text="Child B" route="ab"></bit-nav-item>
        </bit-nav-group>
      </bit-side-nav>
    `,
  }),
};

export const InteractionStates: StoryObj<NavGroupComponent> = {
  render: (args) => ({
    props: {
      ...args,
      handleEditClick: () => alert("Edit button clicked!"),
    },
    template: /*html*/ `
      <bit-side-nav>
         <bit-nav-group text="Nav Group" [route]="['a']" icon="bwi-filter">
          <button
            type="button"
            slot="end"
            class="tw-ms-auto"
            bitIconButton="bwi-pencil-square"
            buttonType="side-nav"
            size="xsmall"
            label="Edit"
            (click)="handleEditClick()"
          ></button>
        </bit-nav-group>
        <bit-nav-group text="Nav Group Hover" [route]="['a']" icon="bwi-filter" data-testid="nav-group-hover">
          <button
            type="button"
            slot="end"
            class="tw-ms-auto tw-test-hover"
            bitIconButton="bwi-pencil-square"
            buttonType="side-nav"
            size="xsmall"
            label="Edit"
            (click)="handleEditClick()"
          ></button>
        </bit-nav-group>
        <bit-nav-group text="Nav Group Focus" [route]="['a']" icon="bwi-filter" data-testid="nav-group-focus">
          <button
            type="button"
            slot="end"
            class="tw-ms-auto tw-test-focus-visible"
            bitIconButton="bwi-pencil-square"
            buttonType="side-nav"
            size="xsmall"
            label="Edit"
            (click)="handleEditClick()"
          ></button>
        </bit-nav-group>

        <bit-nav-group text="Nav Group Active" [route]="['a']" icon="bwi-filter" [forceActiveStyles]="true">
          <button
            type="button"
            slot="end"
            class="tw-ms-auto"
            bitIconButton="bwi-pencil-square"
            buttonType="side-nav"
            size="xsmall"
            label="Edit"
            (click)="handleEditClick()"
          ></button>
        </bit-nav-group>
        <bit-nav-group text="Nav Group Active Hover" [route]="['a']" icon="bwi-filter" [forceActiveStyles]="true" data-testid="nav-group-hover">
          <button
            type="button"
            slot="end"
            class="tw-ms-auto tw-test-hover"
            bitIconButton="bwi-pencil-square"
            buttonType="side-nav"
            size="xsmall"
            label="Edit"
            (click)="handleEditClick()"
          ></button>
        </bit-nav-group>
        <bit-nav-group text="Nav Group Active Focus" [route]="['a']" icon="bwi-filter" [forceActiveStyles]="true" data-testid="nav-group-focus">
          <button
            type="button"
            slot="end"
            class="tw-ms-auto tw-test-focus-visible"
            bitIconButton="bwi-pencil-square"
            buttonType="side-nav"
            size="xsmall"
            label="Edit"
            (click)="handleEditClick()"
          ></button>
        </bit-nav-group>
      </bit-side-nav>
      `,
  }),
  play: async ({ canvas }) => {
    const hoverNavGroups = await canvas.findAllByTestId("nav-group-hover");
    const focusNavGroups = await canvas.findAllByTestId("nav-group-focus");

    // make sure everything is rendered before we try to add test classes
    await canvas.findAllByTestId("nav-group-collapse-arrow");

    hoverNavGroups.forEach((navGroup) => {
      const collapseArrowBtn = navGroup.querySelector('[data-testid="nav-group-collapse-arrow"]');
      collapseArrowBtn?.classList.add("tw-test-hover");
    });

    focusNavGroups.forEach((navGroup) => {
      const collapseArrowBtn = navGroup.querySelector('[data-testid="nav-group-collapse-arrow"]');
      collapseArrowBtn?.classList.add("tw-test-focus-visible");
    });
  },
  parameters: {
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
};

export const InteractionStatesVfo1: StoryObj<NavGroupComponent> = {
  ...InteractionStates,
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  // Unlike v1, the collapse arrow is a decorative icon for v2 top-level groups — the nav-item row
  // is the interactive surface. Force the states on the row container instead.
  play: async ({ canvas }) => {
    const hoverNavGroups = await canvas.findAllByTestId("nav-group-hover");
    const focusNavGroups = await canvas.findAllByTestId("nav-group-focus");

    // make sure everything is rendered before we try to add test classes
    await canvas.findAllByTestId("nav-group-collapse-arrow");

    hoverNavGroups.forEach((navGroup) => {
      const container = navGroup.querySelector('[data-testid="nav-item-container"]');
      container?.classList.add("tw-test-hover");
    });

    focusNavGroups.forEach((navGroup) => {
      const container = navGroup.querySelector('[data-testid="nav-item-container"]');
      // focus-visible-within is JS-driven (see `fvwStyles`), so there is no CSS variant to force —
      // apply the shared fvw ring utilities directly to mirror the focused state.
      container?.classList.add(...FVW_RING_CLASSES.split(" "));
    });
  },
};
