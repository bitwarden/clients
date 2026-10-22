import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, importProvidersFrom } from "@angular/core";
import { RouterModule } from "@angular/router";
import { StoryObj, Meta, moduleMetadata, applicationConfig } from "@storybook/angular";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { GlobalStateProvider } from "@bitwarden/state";
import { enabledFlags } from "@bitwarden/storybook";

import { ChipActionComponent } from "../chips";
import { LayoutComponent } from "../layout";
import { positionFixedWrapperDecorator } from "../stories/storybook-decorators";
import { I18nMockService } from "../utils/i18n-mock.service";
import { StorybookGlobalStateProvider } from "../utils/state-mock";

import { NavSectionComponent } from "./nav-section.component";
import { NavigationModule } from "./navigation.module";

@Component({
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class DummyContentComponent {}

export default {
  title: "Component Library/Nav/Nav Section",
  component: NavSectionComponent,
  decorators: [
    positionFixedWrapperDecorator((story) => `<bit-layout>${story}</bit-layout>`),
    moduleMetadata({
      imports: [
        CommonModule,
        RouterModule,
        NavigationModule,
        DummyContentComponent,
        LayoutComponent,
        ChipActionComponent,
      ],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              close: "Close",
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
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
} as Meta;

export const Default: StoryObj<NavSectionComponent> = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-side-nav>
        <bit-nav-section label="Manage" icon="bwi-collection-shared">
          <bit-nav-item text="My folders" route="folders" icon="bwi-folder"></bit-nav-item>
          <bit-nav-item text="Archive" route="archive" icon="bwi-archive">
            <button slot="end" bit-chip-action startIcon="bwi-diamond" label="Premium" size="small"></button>
          </bit-nav-item>
          <bit-nav-item text="Trash" route="trash" icon="bwi-trash"></bit-nav-item>
          <bit-nav-item text="Settings" route="settings" icon="bwi-cog"></bit-nav-item>
        </bit-nav-section>
      </bit-side-nav>
    `,
  }),
};

/**
 * A section with no items renders a dismissible empty state via `bit-nav-section-empty`. The close
 * button is only shown when the consumer binds `(dismiss)`.
 */
export const EmptyState: StoryObj<NavSectionComponent> = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  render: (args) => ({
    props: { ...args, onDismiss: (): void => undefined },
    template: /*html*/ `
      <bit-side-nav>
        <bit-nav-section label="Pinned" icon="bwi-pin">
          <bit-nav-section-empty (dismiss)="onDismiss()">
            Find a shared folder in this vault and select <b>Pin to sidebar</b> from the Options menu.
          </bit-nav-section-empty>
        </bit-nav-section>
      </bit-side-nav>
    `,
  }),
};
