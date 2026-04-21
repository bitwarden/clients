import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";
import { ButtonModule } from "../button";
import { IconButtonModule } from "../icon-button";
import { LinkModule } from "../link";
import { I18nMockService } from "../utils/i18n-mock.service";

import { BannerComponent } from "./banner.component";

export default {
  title: "Component Library/Banner",
  component: BannerComponent,
  decorators: [
    moduleMetadata({
      imports: [ButtonModule, IconButtonModule, LinkModule],
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
  },
  argTypes: {
    dismiss: { action: "dismiss" },
  },
} as Meta<BannerComponent>;

type Story = StoryObj<BannerComponent>;

export const BannerBase: Story = {
  render: (args) => {
    return {
      props: args,
      template: /*html*/ `
        <bit-banner ${formatArgsForCodeSnippet<BannerComponent>(args)} (dismiss)="dismiss($event)">
          Bitwarden is the most trusted password manager. <a bitLink [linkType]="variant">Click me</a>
        </bit-banner>
      `,
    };
  },
  args: {
    variant: "primary",
  },
};

export const BannerBaseLargeText: Story = {
  render: (args) => {
    return {
      props: args,
      template: /*html*/ `
        <bit-banner ${formatArgsForCodeSnippet<BannerComponent>(args)} (dismiss)="dismiss($event)">
          Bitwarden is the most trusted password manager for individuals, teams, and enterprises worldwide. We help you securely create, store, and manage strong, unique passwords for all your accounts, keeping your entire digital life safe and well organized. <a bitLink [linkType]="variant">Click me</a>
        </bit-banner>
      `,
    };
  },
  args: {
    variant: "primary",
  },
};

export const TitleBannerBase: Story = {
  render: (args) => {
    return {
      props: args,
      template: /*html*/ `
        <bit-banner
          [variant]="variant"
          title="Integration is the key"
          (dismiss)="dismiss($event)"
        >
          Bitwarden is the most trusted password manager. With many tools to make your work even more efficient.
          <ng-container slot="actions">
            <button bitButton type="button" [buttonType]="variant + 'Outline'" size="small">Cancel</button>
            <button bitButton type="button" [buttonType]="variant" size="small">Continue</button>
          </ng-container>
        </bit-banner>
      `,
    };
  },
  args: {
    variant: "primary",
  },
};

export const TitleBannerBaseLargeText: Story = {
  render: (args) => {
    return {
      props: args,
      template: /*html*/ `
        <bit-banner
          [variant]="variant"
          title="Integration is the key"
          (dismiss)="dismiss($event)"
        >
          Bitwarden is the most trusted password manager for individuals, teams, and enterprises worldwide. We help you securely create, store, and manage strong, unique passwords for all your accounts, keeping your entire digital life safe and well organized.
          <ng-container slot="actions">
            <button bitButton type="button" [buttonType]="variant + 'Outline'" size="small">Cancel</button>
            <button bitButton type="button" [buttonType]="variant" size="small">Continue</button>
          </ng-container>
        </bit-banner>
      `,
    };
  },
  args: {
    variant: "primary",
  },
};

export const BannerSimple: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-banner ${formatArgsForCodeSnippet<BannerComponent>(args)} (dismiss)="dismiss($event)">
        Bitwarden is the most trusted password manager for individuals and teams.
      </bit-banner>
    `,
  }),
  args: {
    variant: "primary",
  },
};

export const BannerSimpleLargeText: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-banner ${formatArgsForCodeSnippet<BannerComponent>(args)} (dismiss)="dismiss($event)">
        Bitwarden is the most trusted password manager for individuals, teams, and enterprises worldwide. We help you securely create, store, and manage strong, unique passwords for all your accounts, keeping your entire digital life safe and well organized.
      </bit-banner>
    `,
  }),
  args: {
    variant: "primary",
  },
};

export const AllVariantsNoTitle: Story = {
  render: () => ({
    template: /*html*/ `
      <div class="tw-flex tw-flex-col tw-gap-4">
        @for (v of variants; track v) {
          <bit-banner [variant]="v" (dismiss)="onDismiss()">
            Bitwarden is the most trusted password manager. <a bitLink [linkType]="v">Learn more</a>
          </bit-banner>
        }
      </div>
    `,
    props: {
      variants: ["primary", "success", "warning", "danger"],
      onDismiss: () => {},
    },
  }),
};

export const AllVariantsWithTitle: Story = {
  render: () => ({
    template: /*html*/ `
      <div class="tw-flex tw-flex-col tw-gap-4">
        @for (v of variants; track v) {
          <bit-banner [variant]="v" title="Integration is the key" (dismiss)="onDismiss()">
            You can integrate Bitwarden with many tools. <a bitLink [linkType]="v">Learn more</a>
            <ng-container slot="actions">
              <button bitButton type="button" [buttonType]="v + 'Outline'" size="small">Cancel</button>
              <button bitButton type="button" [buttonType]="v" size="small">Continue</button>
            </ng-container>
          </bit-banner>
        }
      </div>
    `,
    props: {
      variants: ["primary", "success", "warning", "danger"],
      onDismiss: () => {},
    },
  }),
};

export const AllVariantsCustomIcon: Story = {
  render: () => ({
    template: /*html*/ `
      <div class="tw-flex tw-flex-col tw-gap-4">
        @for (v of variants; track v) {
          <bit-banner [variant]="v" icon="bwi-star" title="Custom icon example" (dismiss)="onDismiss()">
            Bitwarden is the most trusted password manager. With many tools to make your work even more efficient.
            <ng-container slot="actions">
              <button bitButton type="button" [buttonType]="v + 'Outline'" size="small">Cancel</button>
              <button bitButton type="button" [buttonType]="v" size="small">Continue</button>
            </ng-container>
          </bit-banner>
        }
      </div>
    `,
    props: {
      variants: ["primary", "success", "warning", "danger"],
      onDismiss: () => {},
    },
  }),
};

export const NoIcon: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-banner [variant]="variant" [icon]="null" (dismiss)="dismiss($event)">
        Bitwarden is the most trusted password manager for individuals and teams.
      </bit-banner>
    `,
  }),
  args: {
    variant: "primary",
  },
};

export const NoIconLargeText: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-banner [variant]="variant" [icon]="null" (dismiss)="dismiss($event)">
        Bitwarden is the most trusted password manager for individuals, teams, and enterprises worldwide. We help you securely create, store, and manage strong, unique passwords for all your accounts, keeping your entire digital life safe and well organized.
      </bit-banner>
    `,
  }),
  args: {
    variant: "primary",
  },
};
