import { RouterTestingModule } from "@angular/router/testing";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { userEvent } from "@storybook/test";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { CalloutModule } from "../callout";
import { NavigationModule } from "../navigation";
import { positionFixedWrapperDecorator } from "../stories/storybook-decorators";
import { I18nMockService } from "../utils/i18n-mock.service";

import { LayoutComponent } from "./layout.component";
import { mockLayoutI18n } from "./mocks";

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
            return new I18nMockService(mockLayoutI18n);
          },
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
      <bit-layout>
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
        <bit-callout title="Foobar"> Hello world! </bit-callout>
      </bit-layout>
    `,
  }),
};
