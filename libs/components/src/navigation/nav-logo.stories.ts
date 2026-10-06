import { provideRouter } from "@angular/router";
import { StoryObj, Meta, moduleMetadata, applicationConfig } from "@storybook/angular";

import { PasswordManagerLogo, SideNavLogoBeta } from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { GlobalStateProvider } from "@bitwarden/state";

import { LayoutComponent } from "../layout";
import { positionFixedWrapperDecorator } from "../stories/storybook-decorators";
import { I18nMockService } from "../utils/i18n-mock.service";
import { StorybookGlobalStateProvider } from "../utils/state-mock";

import { NavLogoComponent } from "./nav-logo.component";
import { NavigationModule } from "./navigation.module";

export default {
  title: "Component Library/Nav/Nav Logo",
  component: NavLogoComponent,
  decorators: [
    positionFixedWrapperDecorator(
      (story) => `<bit-layout><bit-side-nav>${story}</bit-side-nav></bit-layout>`,
    ),
    moduleMetadata({
      imports: [NavigationModule, LayoutComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              passwordManager: "Password Manager",
              toggleCollapse: "toggle collapse",
              toggleSideNavigation: "Toggle side navigation",
              skipToContent: "Skip to content",
              loading: "Loading",
              resizeSideNavigation: "Resize side navigation",
              sideNavigation: "Side navigation",
              skipLink: "Skip link",
            }),
        },
      ],
    }),
    applicationConfig({
      providers: [
        provideRouter([]),
        {
          provide: GlobalStateProvider,
          useClass: StorybookGlobalStateProvider,
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<NavLogoComponent>;

export const Default: Story = {
  render: (args) => ({
    props: { ...args, logo: PasswordManagerLogo },
    template: /*html*/ `
      <bit-nav-logo [openIcon]="logo" [route]="['']" label="Password Manager"></bit-nav-logo>
    `,
  }),
};

export const Dark: Story = {
  ...Default,
  parameters: { themes: { themeOverride: "dark" } },
};

/**
 * Beta variant of the side-nav logo — shipped in beta builds via a build-time flag
 * (`prereleaseBuild`) that `NavLogoComponent` reads directly. Storybook can't flip
 * `process.env.FLAGS`, so this story feeds `SideNavLogoBeta` through `openIcon` on the
 * v1 code path to preview the asset itself in a real nav container.
 */
export const Beta: Story = {
  render: (args) => ({
    props: { ...args, logo: SideNavLogoBeta },
    template: /*html*/ `
      <bit-nav-logo [openIcon]="logo" [route]="['']" label="Password Manager"></bit-nav-logo>
    `,
  }),
};

export const BetaDark: Story = {
  ...Beta,
  parameters: { themes: { themeOverride: "dark" } },
};
