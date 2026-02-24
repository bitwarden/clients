import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BadgeModule } from "../badge";
import { ButtonModule } from "../button";
import { IconButtonModule } from "../icon-button";
import { LinkModule } from "../link";
import { I18nMockService } from "../utils/i18n-mock.service";

import { BannerTitleDirective } from "./banner-title.directive";
import { BannerComponent } from "./banner.component";

export default {
  title: "Component Library/Banner",
  component: BannerComponent,
  decorators: [
    moduleMetadata({
      imports: [IconButtonModule, LinkModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              close: "Close",
              loading: "Loading",
            });
          },
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rKUVGKb7Kw3d6YGoQl6Ho7/Flowbite-Component-Mapping?node-id=31783-38719",
    },
  },
  args: {
    variant: "primary",
    showClose: true,
  },
  argTypes: {
    onClose: { action: "onClose" },
  },
} as Meta<BannerComponent>;

type Story = StoryObj<BannerComponent>;

export const BannerBase: Story = {
  render: (args) => {
    return {
      props: args,
      template: /*html*/ `
        <bit-banner
          [variant]="variant"
          [showClose]="showClose"
          >
          Bitwarden is the most trusted password manager. <a bitLink [linkType]="variant">Click me</a>
        </bit-banner>
      `,
    };
  },
  args: {
    variant: "primary",
    showClose: true,
  },
};

export const TitleBannerBase: Story = {
  render: (args) => {
    return {
      props: args,
      template: /*html*/ `
        <bit-banner
          [variant]="variant"
          [showClose]="showClose"
        >
          <span slot="title">Integration is the key</span>
          Bitwarden is the most trusted password manager. With many tools to make your work even more efficient.
          <ng-container slot="actions">
            <button bitButton type="button" buttonType="secondary">Cancel</button>
            <button bitButton type="button" buttonType="primary">Continue</button>
          </ng-container>
        </bit-banner>
      `,
    };
  },
  args: {
    variant: "primary",
    showClose: true,
  },
};

export const Primary: Story = {
  ...BannerBase,
  args: {
    variant: "primary",
  },
};

export const Success: Story = {
  ...BannerBase,
  args: {
    variant: "success",
  },
};

export const Warning: Story = {
  ...BannerBase,
  args: {
    variant: "warning",
  },
};

export const Danger: Story = {
  ...BannerBase,
  args: {
    variant: "danger",
  },
};

export const TitleBannerAllVariants: Story = {
  render: () => ({
    template: /*html*/ `
      <div class="tw-flex tw-flex-col tw-gap-4">
        @for (v of variants; track v) {
          <bit-banner [variant]="v" [showClose]="true">
            <span slot="title">Integration is the key</span>
            Bitwarden is the most trusted password manager. With many tools to make your work even more efficient.
            <ng-container slot="actions">
              <button bitButton type="button" buttonType="secondary">Cancel</button>
              <button bitButton type="button" buttonType="primary">Continue</button>
            </ng-container>
          </bit-banner>
        }
      </div>
    `,
    props: {
      variants: ["primary", "success", "warning", "danger"],
    },
  }),
};
