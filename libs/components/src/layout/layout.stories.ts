import { RouterTestingModule } from "@angular/router/testing";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { userEvent } from "storybook/test";

import { PasswordManagerLogo } from "@bitwarden/assets/svg";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { GlobalStateProvider } from "@bitwarden/state";
import { enabledFlags, formatArgsForCodeSnippet } from "@bitwarden/storybook";

import { BannerModule } from "../banner";
import { ButtonModule } from "../button";
import { CalloutModule } from "../callout";
import { HeaderComponent } from "../header";
import { NavigationModule } from "../navigation";
import { positionFixedWrapperDecorator } from "../stories/storybook-decorators";
import { I18nMockService } from "../utils/i18n-mock.service";
import { StorybookGlobalStateProvider } from "../utils/state-mock";

import { LayoutComponent } from "./layout.component";
import { mockLayoutI18n } from "./mocks";

export default {
  title: "Component Library/Layout",
  component: LayoutComponent,
  decorators: [
    positionFixedWrapperDecorator(),
    moduleMetadata({
      imports: [
        NavigationModule,
        RouterTestingModule,
        BannerModule,
        ButtonModule,
        CalloutModule,
        HeaderComponent,
      ],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService(mockLayoutI18n);
          },
        },
      ],
    }),
    applicationConfig({
      providers: [
        {
          provide: GlobalStateProvider,
          useClass: StorybookGlobalStateProvider,
        },
      ],
    }),
  ],
  parameters: {
    chromatic: { viewports: [640, 1280] },
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=21662-51009&t=k6OTDDPZOTtypRqo-11",
    },
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
      <bit-layout ${formatArgsForCodeSnippet<LayoutComponent>(args)}>
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
        </bit-side-nav>
        <bit-callout title="Foobar"> Hello world! </bit-callout>
      </bit-layout>
    `,
  }),
};

export const WithContentVfo1: Story = {
  ...WithContent,
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
};

/**
 * Overflowing nav in a tall viewport, where both sticky bands engage. The logo header pins to the
 * top and the account footer to the bottom; below the 600px container-query threshold both release
 * and scroll with the content.
 */
export const StickyChromeVfo1: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  render: (args) => ({
    props: { ...args, logo: PasswordManagerLogo, items: Array.from({ length: 30 }, (_, i) => i) },
    template: /* HTML */ `
      <bit-layout>
        <bit-side-nav>
          <bit-nav-logo [openIcon]="logo" [route]="['']" label="Password Manager"></bit-nav-logo>
          @for (item of items; track item) {
          <bit-nav-item text="Collection {{ item }}" icon="bwi-collection"></bit-nav-item>
          }
          <bit-nav-item slot="account" text="My account" icon="bwi-user"></bit-nav-item>
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
        <bit-callout title="Foobar"> Hello world! </bit-callout>
      </bit-layout>
    `,
  }),
};

export const Rounded: Story = {
  ...WithContent,
  args: {
    rounded: true,
  },
};

export const RoundedVfo1: Story = {
  ...Rounded,
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
};

export const BannerAndHeader: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <bit-layout>
        <bit-side-nav>
          <bit-nav-item text="Members" icon="bwi-user" [route]="['members']"></bit-nav-item>
          <bit-nav-item text="Groups" icon="bwi-collection" [route]="['groups']"></bit-nav-item>
        </bit-side-nav>
        <bit-banner> This organization is being accessed by a provider. </bit-banner>
        <div>
          <!-- <bit-header title="Members" icon="bwi-user">
            <button type="button" bitButton buttonType="primary">Invite member</button>
          </bit-header> -->
          <bit-callout title="Foobar"> Hello world! </bit-callout>
        </div>
      </bit-layout>
    `,
  }),
};

export const BannerAndHeaderVfo1: Story = {
  ...BannerAndHeader,
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
};
