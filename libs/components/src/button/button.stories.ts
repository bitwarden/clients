import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";
import { I18nMockService } from "../utils/i18n-mock.service";

import { ButtonComponent } from "./button.component";

export default {
  title: "Component Library/Button",
  component: ButtonComponent,
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              loading: "Loading",
            }),
        },
      ],
    }),
  ],
  args: {
    disabled: false,
    loading: false,
  },
  argTypes: {
    size: {
      options: ["small", "default"],
      control: { type: "radio" },
    },
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-28224&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta<ButtonComponent>;

type Story = StoryObj<ButtonComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <button type="button" bitButton ${formatArgsForCodeSnippet<ButtonComponent>(args)}>Button</button>
    `,
  }),
  args: {
    buttonType: "secondary",
  },
};

export const Primary: Story = {
  ...Default,
  args: {
    buttonType: "primary",
  },
};

export const DangerPrimary: Story = {
  ...Default,
  args: {
    buttonType: "dangerPrimary",
  },
};

export const Danger: Story = {
  ...Default,
  args: {
    buttonType: "danger",
  },
};

export const Small: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <div class="tw-flex tw-gap-4 tw-mb-6 tw-items-center">
      <button type="button" bitButton [disabled]="disabled" [loading]="loading" [buttonType]="'primary'" [size]="size" [block]="block">Primary small</button>
      <button type="button" bitButton [disabled]="disabled" [loading]="loading" [buttonType]="'secondary'" [size]="size" [block]="block">Secondary small</button>
      <button type="button" bitButton [disabled]="disabled" [loading]="loading" [buttonType]="'danger'" [size]="size" [block]="block">Danger small</button>
      <button type="button" bitButton [disabled]="disabled" [loading]="loading" [buttonType]="'dangerPrimary'" [size]="size" [block]="block">Danger Primary small</button>
    </div>
    `,
  }),
  args: {
    size: "small",
  },
};

export const Loading: Story = {
  ...Default,
  args: {
    loading: true,
  },
};

export const Disabled: Story = {
  ...Loading,
  args: {
    disabled: true,
  },
};

export const DisabledWithAttribute: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      @if (disabled) {
        <button type="button" bitButton disabled [loading]="loading" [block]="block" buttonType="primary" class="tw-me-2">Primary</button>
        <button type="button" bitButton disabled [loading]="loading" [block]="block" buttonType="secondary" class="tw-me-2">Secondary</button>
        <button type="button" bitButton disabled [loading]="loading" [block]="block" buttonType="danger" class="tw-me-2">Danger</button>
      } @else {
        <button type="button" bitButton [loading]="loading" [block]="block" buttonType="primary" class="tw-me-2">Primary</button>
        <button type="button" bitButton [loading]="loading" [block]="block" buttonType="secondary" class="tw-me-2">Secondary</button>
        <button type="button" bitButton [loading]="loading" [block]="block" buttonType="danger" class="tw-me-2">Danger</button>
      }
    `,
  }),
  args: {
    disabled: true,
    loading: false,
  },
};

export const Block: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <span class="tw-flex">
        <button type="button" bitButton [buttonType]="buttonType" [block]="block">[block]="true" Button</button>
        <a bitButton [buttonType]="buttonType" [block]="block" href="#" class="tw-ms-2">[block]="true" Link</a>

        <button type="button" bitButton [buttonType]="buttonType" block class="tw-ms-2">block Button</button>
        <a bitButton [buttonType]="buttonType" block href="#" class="tw-ms-2">block Link</a>
      </span>
    `,
  }),
  args: {
    block: true,
  },
};

export const WithIcon: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <span class="tw-flex tw-gap-8">
        <div>
          <button type="button" bitButton [buttonType]="buttonType" [block]="block">
            <i class="bwi bwi-plus tw-me-2"></i>
            Button label
          </button>
        </div>
        <div>
          <button type="button" bitButton [buttonType]="buttonType" [block]="block">
            Button label
            <i class="bwi bwi-plus tw-ms-2"></i>
          </button>
        </div>
      </span>
    `,
  }),
};

export const InteractionStates: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <div class="tw-flex tw-gap-4 tw-mb-6 tw-items-center">
      <button type="button" bitButton [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [size]="size" [block]="block">Button</button>
      <button type="button" bitButton [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [size]="size" [block]="block" class="tw-test-hover">Button:hover</button>
      <button type="button" bitButton [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [size]="size" [block]="block" class="tw-test-focus-visible">Button:focus-visible</button>
      <button type="button" bitButton [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [size]="size" [block]="block" class="tw-test-hover tw-test-focus-visible">Button:hover:focus-visible</button>
      <button type="button" bitButton [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [size]="size" [block]="block" class="tw-test-active">Button:active</button>
    </div>
    <div class="tw-flex tw-gap-4 tw-items-center">
      <a href="#" bitButton [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [size]="size" [block]="block">Anchor</a>
      <a href="#" bitButton [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [size]="size" [block]="block" class="tw-test-hover">Anchor:hover</a>
      <a href="#" bitButton [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [size]="size" [block]="block" class="tw-test-focus-visible">Anchor:focus-visible</a>
      <a href="#" bitButton [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [size]="size" [block]="block" class="tw-test-hover tw-test-focus-visible">Anchor:hover:focus-visible</a>
      <a href="#" bitButton [disabled]="disabled" [loading]="loading" [buttonType]="buttonType" [size]="size" [block]="block" class="tw-test-active">Anchor:active</a>
    </div>
    `,
  }),
  args: {
    buttonType: "primary",
  },
};
