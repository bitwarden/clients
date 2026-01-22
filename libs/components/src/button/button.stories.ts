import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";
import { ButtonTypes } from "../shared/button-like.abstraction";
import { TypographyModule } from "../typography";
import { I18nMockService } from "../utils/i18n-mock.service";

import { ButtonComponent } from "./button.component";

export default {
  title: "Component Library/Button",
  component: ButtonComponent,
  decorators: [
    moduleMetadata({
      imports: [TypographyModule],
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
      options: ["small", "default", "large"],
      control: { type: "radio" },
    },
    buttonType: {
      options: Object.values(ButtonTypes),
      control: { type: "select" },
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

export const AllVariants: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-flex tw-flex-col tw-gap-8">
        <div class="tw-flex tw-gap-4">
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="primary" bitButton ${formatArgsForCodeSnippet<ButtonComponent>(args)}>Button</button>
            <p class="tw-m-0" bitTypography="helper">primary</p>
          </div>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="primaryOutline" bitButton ${formatArgsForCodeSnippet<ButtonComponent>(args)}>Button</button>
            <p class="tw-m-0" bitTypography="helper">primaryOutline</p>
          </div>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="primaryGhost" bitButton ${formatArgsForCodeSnippet<ButtonComponent>(args)}>Button</button>
            <p class="tw-m-0" bitTypography="helper">primaryGhost</p>
          </div>
        </div>
        <div class="tw-flex tw-gap-4">
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="secondary" bitButton ${formatArgsForCodeSnippet<ButtonComponent>(args)}>Button</button>
            <p class="tw-m-0" bitTypography="helper">secondary</p>
          </div>
        </div>
        <div class="tw-flex tw-gap-4">
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="subtle" bitButton ${formatArgsForCodeSnippet<ButtonComponent>(args)}>Button</button>
            <p class="tw-m-0" bitTypography="helper">subtle</p>
          </div>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="subtleOutline" bitButton ${formatArgsForCodeSnippet<ButtonComponent>(args)}>Button</button>
            <p class="tw-m-0" bitTypography="helper">subtleOutline</p>
          </div>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="subtleGhost" bitButton ${formatArgsForCodeSnippet<ButtonComponent>(args)}>Button</button>
            <p class="tw-m-0" bitTypography="helper">subtleGhost</p>
          </div>
        </div>
        <div class="tw-flex tw-gap-4">
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="danger" bitButton ${formatArgsForCodeSnippet<ButtonComponent>(args)}>Button</button>
            <p class="tw-m-0" bitTypography="helper">danger</p>
          </div>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="dangerOutline" bitButton ${formatArgsForCodeSnippet<ButtonComponent>(args)}>Button</button>
            <p class="tw-m-0" bitTypography="helper">dangerOutline</p>
          </div>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="dangerGhost" bitButton ${formatArgsForCodeSnippet<ButtonComponent>(args)}>Button</button>
            <p class="tw-m-0" bitTypography="helper">dangerGhost</p>
          </div>
        </div>
        <div class="tw-flex tw-gap-4">
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="warning" bitButton ${formatArgsForCodeSnippet<ButtonComponent>(args)}>Button</button>
            <p class="tw-m-0" bitTypography="helper">warning</p>
          </div>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="warningOutline" bitButton ${formatArgsForCodeSnippet<ButtonComponent>(args)}>Button</button>
            <p class="tw-m-0" bitTypography="helper">warningOutline</p>
          </div>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="warningGhost" bitButton ${formatArgsForCodeSnippet<ButtonComponent>(args)}>Button</button>
            <p class="tw-m-0" bitTypography="helper">warningGhost</p>
          </div>
        </div>
        <div class="tw-flex tw-gap-4">
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="success" bitButton ${formatArgsForCodeSnippet<ButtonComponent>(args)}>Button</button>
            <p class="tw-m-0" bitTypography="helper">success</p>
          </div>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="successOutline" bitButton ${formatArgsForCodeSnippet<ButtonComponent>(args)}>Button</button>
            <p class="tw-m-0" bitTypography="helper">successOutline</p>
          </div>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="successGhost" bitButton ${formatArgsForCodeSnippet<ButtonComponent>(args)}>Button</button>
            <p class="tw-m-0" bitTypography="helper">successGhost</p>
          </div>
        </div>
      </div>
    `,
  }),
};

const sizeTemplate = /*html*/ `
  <div class="tw-flex tw-flex-col tw-gap-8">
      <div class="tw-flex tw-gap-4 tw-items-center">
        <button type="button" bitButton [disabled]="disabled" [loading]="loading" buttonType="primary" [size]="size" [block]="block">Primary small</button>
        <button type="button" bitButton [disabled]="disabled" [loading]="loading" buttonType="primaryOutline" [size]="size" [block]="block">Primary outline small</button>
        <button type="button" bitButton [disabled]="disabled" [loading]="loading" buttonType="primaryGhost" [size]="size" [block]="block">Primary ghost small</button>
        
      </div>
      <div class="tw-flex tw-gap-4 tw-items-center">
        <button type="button" bitButton [disabled]="disabled" [loading]="loading" buttonType="secondary" [size]="size" [block]="block">Secondary small</button>
      </div>
      <div class="tw-flex tw-gap-4 tw-items-center">
        <button type="button" bitButton [disabled]="disabled" [loading]="loading" buttonType="subtle" [size]="size" [block]="block">subtle small</button>
        <button type="button" bitButton [disabled]="disabled" [loading]="loading" buttonType="subtleOutline" [size]="size" [block]="block">subtle outline small</button>
        <button type="button" bitButton [disabled]="disabled" [loading]="loading" buttonType="subtleGhost" [size]="size" [block]="block">subtle ghost small</button>
      </div>
      <div class="tw-flex tw-gap-4 tw-items-center">
        <button type="button" bitButton [disabled]="disabled" [loading]="loading" buttonType="danger" [size]="size" [block]="block">Danger small</button>
        <button type="button" bitButton [disabled]="disabled" [loading]="loading" buttonType="dangerOutline" [size]="size" [block]="block">Danger outline small</button>
        <button type="button" bitButton [disabled]="disabled" [loading]="loading" buttonType="dangerGhost" [size]="size" [block]="block">Danger ghost small</button>
      </div>
      <div class="tw-flex tw-gap-4 tw-items-center">
        <button type="button" bitButton [disabled]="disabled" [loading]="loading" buttonType="warning" [size]="size" [block]="block">warning small</button>
        <button type="button" bitButton [disabled]="disabled" [loading]="loading" buttonType="warningOutline" [size]="size" [block]="block">warning outline small</button>
        <button type="button" bitButton [disabled]="disabled" [loading]="loading" buttonType="warningGhost" [size]="size" [block]="block">warning ghost small</button>
      </div>
      <div class="tw-flex tw-gap-4 tw-items-center">
        <button type="button" bitButton [disabled]="disabled" [loading]="loading" buttonType="success" [size]="size" [block]="block">success small</button>
        <button type="button" bitButton [disabled]="disabled" [loading]="loading" buttonType="successOutline" [size]="size" [block]="block">success outline small</button>
        <button type="button" bitButton [disabled]="disabled" [loading]="loading" buttonType="successGhost" [size]="size" [block]="block">success ghost small</button>
      </div>
    </div>
`;

export const Small: Story = {
  render: (args) => ({
    props: args,
    template: sizeTemplate,
  }),
  args: {
    size: "small",
  },
};

export const Large: Story = {
  render: (args) => ({
    props: args,
    template: sizeTemplate,
  }),
  args: {
    size: "large",
  },
};

export const Loading: Story = {
  ...Default,
  args: {
    loading: true,
  },
};

export const Inactive: Story = {
  ...Loading,
  args: {
    disabled: true,
  },
};

export const InactiveWithAttribute: Story = {
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
