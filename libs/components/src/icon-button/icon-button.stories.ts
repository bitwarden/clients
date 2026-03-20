import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";
import { ButtonType, ButtonTypes } from "../shared/button-like.abstraction";
import { TypographyModule } from "../typography";
import { I18nMockService } from "../utils";

import { BitIconButtonComponent } from "./icon-button.component";

export default {
  title: "Component Library/Icon Button",
  component: BitIconButtonComponent,
  decorators: [
    moduleMetadata({
      imports: [TypographyModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              loading: "Loading",
            });
          },
        },
      ],
    }),
  ],
  args: {
    bitIconButton: "bwi-add",
    label: "Your button label here",
  },
  argTypes: {
    bitIconButton: {
      control: { type: "text" },
      description: "The icon class to display",
      table: {
        type: { summary: "string" },
      },
    },
    label: {
      control: { type: "text" },
      description: "Accessible label for screen readers and tooltip content",
      table: {
        type: { summary: "string" },
      },
    },
    buttonType: {
      options: Object.values(ButtonTypes),
      control: { type: "select" },
      description: "The visual style variant of the icon button",
      table: {
        type: { summary: "ButtonType" },
        defaultValue: { summary: "primaryGhost" },
      },
    },
    size: {
      options: ["xsmall", "small", "default"],
      control: { type: "radio" },
      description: "The size of the icon button",
      table: {
        type: { summary: '"xsmall" | "small" | "default"' },
        defaultValue: { summary: "default" },
      },
    },
    loading: {
      control: { type: "boolean" },
      description: "Whether the icon button is in a loading state",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    disabled: {
      control: { type: "boolean" },
      description: "Whether the icon button is disabled",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-37011&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta<BitIconButtonComponent>;

// Extend BitIconButtonComponent type to include host directive inputs for Storybook
type BitIconButtonComponentWithHostDirectiveInputs = BitIconButtonComponent & {
  buttonType: ButtonType;
  loading: boolean;
  disabled: boolean;
};

type Story = StoryObj<BitIconButtonComponentWithHostDirectiveInputs>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <button type="button" ${formatArgsForCodeSnippet<BitIconButtonComponent>(args)}>Button</button>
    `,
  }),
};

export const AllVariants: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-flex tw-flex-col tw-gap-8">
        <div class="tw-flex tw-gap-4">
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="primary" bitIconButton="bwi-add" label="Primary" ${formatArgsForCodeSnippet<BitIconButtonComponent>(args)}></button>
            <p class="tw-m-0" bitTypography="helper">primary</p>
          </div>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="primaryOutline" bitIconButton="bwi-add" label="Primary outline" ${formatArgsForCodeSnippet<BitIconButtonComponent>(args)}></button>
            <p class="tw-m-0" bitTypography="helper">primaryOutline</p>
          </div>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="primaryGhost" bitIconButton="bwi-add" label="Primary ghost" ${formatArgsForCodeSnippet<BitIconButtonComponent>(args)}></button>
            <p class="tw-m-0" bitTypography="helper">primaryGhost</p>
          </div>
        </div>
        <div class="tw-flex tw-gap-4">
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="secondary" bitIconButton="bwi-add" label="Secondary" ${formatArgsForCodeSnippet<BitIconButtonComponent>(args)}></button>
            <p class="tw-m-0" bitTypography="helper">secondary</p>
          </div>
        </div>
        <div class="tw-flex tw-gap-4">
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="subtle" bitIconButton="bwi-add" label="Subtle" ${formatArgsForCodeSnippet<BitIconButtonComponent>(args)}></button>
            <p class="tw-m-0" bitTypography="helper">subtle</p>
          </div>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="subtleOutline" bitIconButton="bwi-add" label="Subtle outline" ${formatArgsForCodeSnippet<BitIconButtonComponent>(args)}></button>
            <p class="tw-m-0" bitTypography="helper">subtleOutline</p>
          </div>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="subtleGhost" bitIconButton="bwi-add" label="Subtle ghost" ${formatArgsForCodeSnippet<BitIconButtonComponent>(args)}></button>
            <p class="tw-m-0" bitTypography="helper">subtleGhost</p>
          </div>
        </div>
        <div class="tw-flex tw-gap-4">
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="danger" bitIconButton="bwi-add" label="Danger" ${formatArgsForCodeSnippet<BitIconButtonComponent>(args)}></button>
            <p class="tw-m-0" bitTypography="helper">danger</p>
          </div>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="dangerOutline" bitIconButton="bwi-add" label="Danger outline" ${formatArgsForCodeSnippet<BitIconButtonComponent>(args)}></button>
            <p class="tw-m-0" bitTypography="helper">dangerOutline</p>
          </div>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="dangerGhost" bitIconButton="bwi-add" label="Danger ghost" ${formatArgsForCodeSnippet<BitIconButtonComponent>(args)}></button>
            <p class="tw-m-0" bitTypography="helper">dangerGhost</p>
          </div>
        </div>
        <div class="tw-flex tw-gap-4">
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="warning" bitIconButton="bwi-add" label="Warning" ${formatArgsForCodeSnippet<BitIconButtonComponent>(args)}></button>
            <p class="tw-m-0" bitTypography="helper">warning</p>
          </div>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="warningOutline" bitIconButton="bwi-add" label="Warning outline" ${formatArgsForCodeSnippet<BitIconButtonComponent>(args)}></button>
            <p class="tw-m-0" bitTypography="helper">warningOutline</p>
          </div>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="warningGhost" bitIconButton="bwi-add" label="Warning ghost" ${formatArgsForCodeSnippet<BitIconButtonComponent>(args)}></button>
            <p class="tw-m-0" bitTypography="helper">warningGhost</p>
          </div>
        </div>
        <div class="tw-flex tw-gap-4">
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="success" bitIconButton="bwi-add" label="Success" ${formatArgsForCodeSnippet<BitIconButtonComponent>(args)}></button>
            <p class="tw-m-0" bitTypography="helper">success</p>
          </div>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="successOutline" bitIconButton="bwi-add" label="Success outline" ${formatArgsForCodeSnippet<BitIconButtonComponent>(args)}></button>
            <p class="tw-m-0" bitTypography="helper">successOutline</p>
          </div>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="successGhost" bitIconButton="bwi-add" label="Success ghost" ${formatArgsForCodeSnippet<BitIconButtonComponent>(args)}></button>
            <p class="tw-m-0" bitTypography="helper">successGhost</p>
          </div>
        </div>

        <div class="tw-flex tw-gap-4 tw-bg-bg-contrast tw-text-contrast tw-p-4">
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="contrast" bitIconButton="bwi-add" label="Contrast" ${formatArgsForCodeSnippet<BitIconButtonComponent>(args)}></button>
            <p class="tw-m-0" bitTypography="helper">contrast</p>
          </div>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="contrastOutline" bitIconButton="bwi-add" label="Contrast outline" ${formatArgsForCodeSnippet<BitIconButtonComponent>(args)}></button>
            <p class="tw-m-0" bitTypography="helper">contrastOutline</p>
          </div>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <button buttonType="contrastGhost" bitIconButton="bwi-add" label="Contrast ghost" ${formatArgsForCodeSnippet<BitIconButtonComponent>(args)}></button>
            <p class="tw-m-0" bitTypography="helper">contrastGhost</p>
          </div>
        </div>
      </div>
    `,
  }),
  parameters: {
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
};

const sizeTemplate = /*html*/ `
  <div class="tw-flex tw-flex-col tw-gap-8">
      <div class="tw-flex tw-gap-4 tw-items-center">
        <button type="button" bitIconButton="bwi-add" label="Primary" [disabled]="disabled" [loading]="loading" buttonType="primary" [size]="size"></button>
        <button type="button" bitIconButton="bwi-add" label="Primary outline" [disabled]="disabled" [loading]="loading" buttonType="primaryOutline" [size]="size"></button>
        <button type="button" bitIconButton="bwi-add" label="Primary ghost" [disabled]="disabled" [loading]="loading" buttonType="primaryGhost" [size]="size"></button>
      </div>
      <div class="tw-flex tw-gap-4 tw-items-center">
        <button type="button" bitIconButton="bwi-add" label="Secondary" [disabled]="disabled" [loading]="loading" buttonType="secondary" [size]="size"></button>
      </div>
      <div class="tw-flex tw-gap-4 tw-items-center">
        <button type="button" bitIconButton="bwi-add" label="Subtle" [disabled]="disabled" [loading]="loading" buttonType="subtle" [size]="size"></button>
        <button type="button" bitIconButton="bwi-add" label="Subtle outline" [disabled]="disabled" [loading]="loading" buttonType="subtleOutline" [size]="size"></button>
        <button type="button" bitIconButton="bwi-add" label="Subtle ghost" [disabled]="disabled" [loading]="loading" buttonType="subtleGhost" [size]="size"></button>
      </div>
      <div class="tw-flex tw-gap-4 tw-items-center">
        <button type="button" bitIconButton="bwi-add" label="Danger" [disabled]="disabled" [loading]="loading" buttonType="danger" [size]="size"></button>
        <button type="button" bitIconButton="bwi-add" label="Danger outline" [disabled]="disabled" [loading]="loading" buttonType="dangerOutline" [size]="size"></button>
        <button type="button" bitIconButton="bwi-add" label="Danger ghost" [disabled]="disabled" [loading]="loading" buttonType="dangerGhost" [size]="size"></button>
      </div>
      <div class="tw-flex tw-gap-4 tw-items-center">
        <button type="button" bitIconButton="bwi-add" label="Warning" [disabled]="disabled" [loading]="loading" buttonType="warning" [size]="size"></button>
        <button type="button" bitIconButton="bwi-add" label="Warning outline" [disabled]="disabled" [loading]="loading" buttonType="warningOutline" [size]="size"></button>
        <button type="button" bitIconButton="bwi-add" label="Warning ghost" [disabled]="disabled" [loading]="loading" buttonType="warningGhost" [size]="size"></button>
      </div>
      <div class="tw-flex tw-gap-4 tw-items-center">
        <button type="button" bitIconButton="bwi-add" label="Success" [disabled]="disabled" [loading]="loading" buttonType="success" [size]="size"></button>
        <button type="button" bitIconButton="bwi-add" label="Success outline" [disabled]="disabled" [loading]="loading" buttonType="successOutline" [size]="size"></button>
        <button type="button" bitIconButton="bwi-add" label="Success ghost" [disabled]="disabled" [loading]="loading" buttonType="successGhost" [size]="size"></button>
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
    disabled: false,
    loading: true,
  },
};

export const Inactive: Story = {
  ...Default,
  args: {
    disabled: true,
    loading: false,
  },
};
