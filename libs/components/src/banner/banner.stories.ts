import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";
import { IconButtonModule } from "../icon-button";
import { LinkModule } from "../link";
import { SharedModule } from "../shared/shared.module";
import { I18nMockService } from "../utils/i18n-mock.service";

import { BannerComponent } from "./banner.component";

export default {
  title: "Component Library/Banner",
  component: BannerComponent,
  decorators: [
    moduleMetadata({
      imports: [SharedModule, IconButtonModule, LinkModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              close: "Close",
            });
          },
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-26720&t=b5tDKylm5sWm2yKo-4",
    },
  },
  args: {
    bannerType: "warning",
    showClose: true,
  },
  argTypes: {
    onClose: { action: "onClose" },
  },
} as Meta<BannerComponent>;

type Story = StoryObj<BannerComponent>;

export const Base: Story = {
  render: (args) => {
    return {
      props: args,
      template: `
        <bit-banner ${formatArgsForCodeSnippet<BannerComponent>(args)}>
          Content Really Long Text Lorem Ipsum Ipsum Ipsum
          <button bitLink linkType="secondary">Button</button>
        </bit-banner>
      `,
    };
  },
};

export const Premium: Story = {
  ...Base,
  args: {
    bannerType: "premium",
  },
};

export const Info: Story = {
  ...Base,
  args: {
    bannerType: "info",
  },
};

export const Warning: Story = {
  ...Base,
  args: {
    bannerType: "warning",
  },
};

export const Danger: Story = {
  ...Base,
  args: {
    bannerType: "danger",
  },
};

export const HideClose: Story = {
  ...Base,
  args: {
    showClose: false,
  },
};

export const Stacked: Story = {
  args: {},
  render: (args) => ({
    props: args,
    template: `
      <bit-banner bannerType="premium" (onClose)="onClose($event)">
        Bruce
      </bit-banner>
      <bit-banner bannerType="premium" (onClose)="onClose($event)">
        Bruce
      </bit-banner>
      <bit-banner bannerType="warning" (onClose)="onClose($event)">
        Bruce
      </bit-banner>
      <bit-banner bannerType="warning" (onClose)="onClose($event)">
        Bruce
      </bit-banner>
      <bit-banner bannerType="danger" (onClose)="onClose($event)">
        Bruce
      </bit-banner>
      <bit-banner bannerType="danger" (onClose)="onClose($event)">
        Bruce
      </bit-banner>
      <bit-banner bannerType="info" (onClose)="onClose($event)">
        Bruce
      </bit-banner>
      <bit-banner bannerType="info" (onClose)="onClose($event)">
        Bruce
      </bit-banner>
      `,
  }),
};
