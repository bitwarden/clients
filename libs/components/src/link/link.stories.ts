import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";

import { LinkComponent } from "./link.component";
import { LinkModule } from "./link.module";

export default {
  title: "Component Library/Link",
  decorators: [
    moduleMetadata({
      imports: [LinkModule],
    }),
  ],
  argTypes: {
    linkType: {
      options: ["primary", "secondary", "contrast"],
      control: { type: "radio" },
    },
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-39582&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta;

type Story = StoryObj<LinkComponent>;

export const Default: Story = {
  render: (args) => ({
    template: /*html*/ `
      <a bitLink href="#" ${formatArgsForCodeSnippet<LinkComponent>(args)}>Your text here</a>
    `,
  }),
};

export const InteractionStates: Story = {
  render: () => ({
    template: /*html*/ `
      <div class="tw-flex tw-gap-4 tw-p-2 tw-mb-6">
        <a bitLink linkType="primary" href="#">Primary</a>
        <a bitLink linkType="primary" href="#" class="tw-test-hover">Primary</a>
        <a bitLink linkType="primary" href="#" class="tw-test-focus-visible">Primary</a>
        <a bitLink linkType="primary" href="#" class="tw-test-hover tw-test-focus-visible">Primary</a>
      </div>
      <div class="tw-flex tw-gap-4 tw-p-2 tw-mb-6">
        <a bitLink linkType="secondary" href="#">Secondary</a>
        <a bitLink linkType="secondary" href="#" class="tw-test-hover">Secondary</a>
        <a bitLink linkType="secondary" href="#" class="tw-test-focus-visible">Secondary</a>
        <a bitLink linkType="secondary" href="#" class="tw-test-hover tw-test-focus-visible">Secondary</a>
      </div>
      <div class="tw-flex tw-gap-4 tw-p-2 tw-mb-6 tw-bg-primary-600">
        <a bitLink linkType="contrast" href="#">Contrast</a>
        <a bitLink linkType="contrast" href="#" class="tw-test-hover">Contrast</a>
        <a bitLink linkType="contrast" href="#" class="tw-test-focus-visible">Contrast</a>
        <a bitLink linkType="contrast" href="#" class="tw-test-hover tw-test-focus-visible">Contrast</a>
      </div>
      <div class="tw-flex tw-gap-4 tw-p-2 tw-mb-6 tw-bg-primary-600">
        <a bitLink linkType="light" href="#">Light</a>
        <a bitLink linkType="light" href="#" class="tw-test-hover">Light</a>
        <a bitLink linkType="light" href="#" class="tw-test-focus-visible">Light</a>
        <a bitLink linkType="light" href="#" class="tw-test-hover tw-test-focus-visible">Light</a>
      </div>
    `,
  }),
};

export const Buttons: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <div class="tw-p-2" [ngClass]="{ 'tw-bg-transparent': linkType != 'contrast', 'tw-bg-primary-600': linkType === 'contrast' }">
      <div class="tw-block tw-p-2">
        <button type="button" bitLink [linkType]="linkType">Button</button>
      </div>
      <div class="tw-block tw-p-2">
        <button type="button" bitLink [linkType]="linkType" startIcon="bwi-plus-circle">
          Add Icon Button
        </button>
      </div>
      <div class="tw-block tw-p-2">
        <button type="button" bitLink [linkType]="linkType" endIcon="bwi-angle-right">
          Chevron Icon Button
        </button>
      </div>
      <div class="tw-block tw-p-2">
        <button type="button" bitLink [linkType]="linkType" class="tw-text-sm">Small Button</button>
      </div>
    </div>
    `,
  }),
  args: {
    linkType: "primary",
  },
};

export const Anchors: StoryObj<LinkComponent> = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <div class="tw-p-2" [ngClass]="{ 'tw-bg-transparent': linkType != 'contrast', 'tw-bg-primary-600': linkType === 'contrast' }">
      <div class="tw-block tw-p-2">
        <a bitLink [linkType]="linkType" href="#">Anchor</a>
      </div>
      <div class="tw-block tw-p-2">
        <a bitLink [linkType]="linkType" href="#" startIcon="bwi-plus-circle">
          Add Icon Anchor
        </a>
      </div>
      <div class="tw-block tw-p-2">
        <a bitLink [linkType]="linkType" href="#" endIcon="bwi-angle-right">
          Chevron Icon Anchor
        </a>
      </div>
      <div class="tw-block tw-p-2">
        <a bitLink [linkType]="linkType" class="tw-text-sm" href="#">Small Anchor</a>
      </div>
    </div>
    `,
  }),
  args: {
    linkType: "primary",
  },
};

export const Inline: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <span class="tw-text-main">
        On the internet paragraphs often contain <a bitLink href="#">inline links with very long text that might break</a>, but few know that <button type="button" bitLink>buttons</button> can be used for similar purposes.
      </span>
    `,
  }),
  args: {
    linkType: "primary",
  },
};

export const WithIcons: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <div class="tw-p-2" [ngClass]="{ 'tw-bg-transparent': linkType != 'contrast', 'tw-bg-primary-600': linkType === 'contrast' }">
      <div class="tw-block tw-p-2">
        <a bitLink [linkType]="linkType" href="#" startIcon="bwi-star">Start icon link</a>
      </div>
      <div class="tw-block tw-p-2">
        <a bitLink [linkType]="linkType" href="#" endIcon="bwi-external-link">External link</a>
      </div>
      <div class="tw-block tw-p-2">
        <a bitLink [linkType]="linkType" href="#" startIcon="bwi-arrow-left" endIcon="bwi-arrow-right">Both icons</a>
      </div>
      <div class="tw-block tw-p-2">
        <button type="button" bitLink [linkType]="linkType" startIcon="bwi-plus-circle">Add item</button>
      </div>
      <div class="tw-block tw-p-2">
        <button type="button" bitLink [linkType]="linkType" endIcon="bwi-angle-right">Next</button>
      </div>
      <div class="tw-block tw-p-2">
        <button type="button" bitLink [linkType]="linkType" startIcon="bwi-download" endIcon="bwi-check">Download complete</button>
      </div>
    </div>
    `,
  }),
  args: {
    linkType: "primary",
  },
};

export const Disabled: Story = {
  render: (args) => ({
    props: {
      ...args,
      onClick: () => {
        alert("Button clicked! (This should not appear when disabled)");
      },
    },
    template: /*html*/ `
      <button type="button" bitLink (click)="onClick()" disabled linkType="primary" class="tw-me-2">Primary button</button>
      <a bitLink disabled linkType="primary" class="tw-me-2">Links can not be disabled</a>
      <button type="button" bitLink disabled linkType="secondary" class="tw-me-2">Secondary button</button>
      <div class="tw-bg-primary-600 tw-p-2 tw-inline-block">
        <button type="button" bitLink disabled linkType="contrast">Contrast button</button>
      </div>
    `,
  }),
  parameters: {
    controls: {
      exclude: ["linkType"],
      hideNoControlsWarning: true,
    },
  },
};
