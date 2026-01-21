import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";

import { AnchorLinkDirective, ButtonLinkDirective, LinkTypes } from "./link.directive";
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
      options: LinkTypes.map((type) => type),
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

type Story = StoryObj<ButtonLinkDirective>;

export const Default: Story = {
  render: (args) => ({
    props: {
      linkType: args.linkType,
      backgroundClass:
        args.linkType === "contrast"
          ? "tw-bg-bg-contrast"
          : args.linkType === "light"
            ? "tw-bg-bg-brand"
            : "tw-bg-transparent",
    },
    template: /*html*/ `
      <div class="tw-p-2" [class]="backgroundClass">
        <a bitLink href="" ${formatArgsForCodeSnippet<ButtonLinkDirective>(args)}>Your text here</a>
      </div>
    `,
  }),
  args: {
    linkType: "primary",
  },
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};

export const AllVariations: Story = {
  render: () => ({
    template: /*html*/ `
      <div class="tw-flex tw-flex-col tw-gap-6">
        <div class="tw-flex tw-gap-4 tw-p-2">
          <a bitLink linkType="primary" href="#">Primary</a>
        </div>
        <div class="tw-flex tw-gap-4 tw-p-2">
          <a bitLink linkType="secondary" href="#">Secondary</a>
        </div>
        <div class="tw-flex tw-gap-4 tw-p-2 tw-bg-bg-contrast">
          <a bitLink linkType="contrast" href="#">Contrast</a>
        </div>
        <div class="tw-flex tw-gap-4 tw-p-2 tw-bg-bg-brand">
          <a bitLink linkType="light" href="#">Light</a>
        </div>
        <div class="tw-flex tw-gap-4 tw-p-2">
          <a bitLink linkType="default" href="#">Default</a>
        </div>
        <div class="tw-flex tw-gap-4 tw-p-2">
          <a bitLink linkType="subtle" href="#">Subtle</a>
        </div>
        <div class="tw-flex tw-gap-4 tw-p-2">
          <a bitLink linkType="success" href="#">Success</a>
        </div>
        <div class="tw-flex tw-gap-4 tw-p-2">
          <a bitLink linkType="warning" href="#">Warning</a>
        </div>
        <div class="tw-flex tw-gap-4 tw-p-2">
          <a bitLink linkType="danger" href="#">Danger</a>
        </div>
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

export const InteractionStates: Story = {
  render: () => ({
    template: /*html*/ `
      <div class="tw-flex tw-flex-col tw-gap-6">
        <div class="tw-flex tw-gap-4 tw-p-2">
        <a bitLink linkType="primary" href="#">Primary</a>
        <a bitLink linkType="primary" href="#" class="tw-test-hover">Primary</a>
        <a bitLink linkType="primary" href="#" class="tw-test-focus-visible">Primary</a>
        <a bitLink linkType="primary" href="#" class="tw-test-hover tw-test-focus-visible">Primary</a>
      </div>
      <div class="tw-flex tw-gap-4 tw-p-2">
        <a bitLink linkType="secondary" href="#">Secondary</a>
        <a bitLink linkType="secondary" href="#" class="tw-test-hover">Secondary</a>
        <a bitLink linkType="secondary" href="#" class="tw-test-focus-visible">Secondary</a>
        <a bitLink linkType="secondary" href="#" class="tw-test-hover tw-test-focus-visible">Secondary</a>
      </div>
      <div class="tw-flex tw-gap-4 tw-p-2 tw-bg-bg-contrast">
        <a bitLink linkType="contrast" href="#">Contrast</a>
        <a bitLink linkType="contrast" href="#" class="tw-test-hover">Contrast</a>
        <a bitLink linkType="contrast" href="#" class="tw-test-focus-visible">Contrast</a>
        <a bitLink linkType="contrast" href="#" class="tw-test-hover tw-test-focus-visible">Contrast</a>
      </div>
      <div class="tw-flex tw-gap-4 tw-p-2 tw-bg-bg-brand">
        <a bitLink linkType="light" href="#">Light</a>
        <a bitLink linkType="light" href="#" class="tw-test-hover">Light</a>
        <a bitLink linkType="light" href="#" class="tw-test-focus-visible">Light</a>
        <a bitLink linkType="light" href="#" class="tw-test-hover tw-test-focus-visible">Light</a>
      </div>
      <div class="tw-flex tw-gap-4 tw-p-2">
        <a bitLink linkType="default" href="#">Default</a>
        <a bitLink linkType="default" href="#" class="tw-test-hover">Default</a>
        <a bitLink linkType="default" href="#" class="tw-test-focus-visible">Default</a>
        <a bitLink linkType="default" href="#" class="tw-test-hover tw-test-focus-visible">Default</a>
      </div>
      <div class="tw-flex tw-gap-4 tw-p-2">
        <a bitLink linkType="subtle" href="#">Subtle</a>
        <a bitLink linkType="subtle" href="#" class="tw-test-hover">Subtle</a>
        <a bitLink linkType="subtle" href="#" class="tw-test-focus-visible">Subtle</a>
        <a bitLink linkType="subtle" href="#" class="tw-test-hover tw-test-focus-visible">Subtle</a>
      </div>
      <div class="tw-flex tw-gap-4 tw-p-2">
        <a bitLink linkType="success" href="#">Success</a>
        <a bitLink linkType="success" href="#" class="tw-test-hover">Success</a>
        <a bitLink linkType="success" href="#" class="tw-test-focus-visible">Success</a>
        <a bitLink linkType="success" href="#" class="tw-test-hover tw-test-focus-visible">Success</a>
      </div>
      <div class="tw-flex tw-gap-4 tw-p-2">
        <a bitLink linkType="warning" href="#">Warning</a>
        <a bitLink linkType="warning" href="#" class="tw-test-hover">Warning</a>
        <a bitLink linkType="warning" href="#" class="tw-test-focus-visible">Warning</a>
        <a bitLink linkType="warning" href="#" class="tw-test-hover tw-test-focus-visible">Warning</a>
      </div>
      <div class="tw-flex tw-gap-4 tw-p-2">
        <a bitLink linkType="danger" href="#">Danger</a>
        <a bitLink linkType="danger" href="#" class="tw-test-hover">Danger</a>
        <a bitLink linkType="danger" href="#" class="tw-test-focus-visible">Danger</a>
        <a bitLink linkType="danger" href="#" class="tw-test-hover tw-test-focus-visible">Danger</a>
      </div>
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

export const Buttons: Story = {
  render: (args) => ({
    props: {
      linkType: args.linkType,
      backgroundClass:
        args.linkType === "contrast"
          ? "tw-bg-bg-contrast"
          : args.linkType === "light"
            ? "tw-bg-bg-brand"
            : "tw-bg-transparent",
    },
    template: /*html*/ `
    <div class="tw-p-2" [class]="backgroundClass">
      <div class="tw-block tw-p-2">
        <button type="button" bitLink [linkType]="linkType">Button</button>
      </div>
      <div class="tw-block tw-p-2">
        <button type="button" bitLink [linkType]="linkType">
          <i class="bwi bwi-fw bwi-plus-circle" aria-hidden="true"></i>
          Add Icon Button
        </button>
      </div>
      <div class="tw-block tw-p-2">
        <button type="button" bitLink [linkType]="linkType">
          <i class="bwi bwi-fw bwi-sm bwi-angle-right" aria-hidden="true"></i>
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

export const Anchors: StoryObj<AnchorLinkDirective> = {
  render: (args) => ({
    props: {
      linkType: args.linkType,
      backgroundClass:
        args.linkType === "contrast"
          ? "tw-bg-bg-contrast"
          : args.linkType === "light"
            ? "tw-bg-bg-brand"
            : "tw-bg-transparent",
    },
    template: /*html*/ `
    <div class="tw-p-2" [class]="backgroundClass">
      <div class="tw-block tw-p-2">
        <a bitLink [linkType]="linkType" href="#">Anchor</a>
      </div>
      <div class="tw-block tw-p-2">
        <a bitLink [linkType]="linkType" href="#">
          <i class="bwi bwi-fw bwi-plus-circle" aria-hidden="true"></i>
          Add Icon Anchor
        </a>
      </div>
      <div class="tw-block tw-p-2">
        <a bitLink [linkType]="linkType" href="#">
          <i class="bwi bwi-fw bwi-sm bwi-angle-right" aria-hidden="true"></i>
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
        On the internet paragraphs often contain <a bitLink href="#">inline links</a>, but few know that <button type="button" bitLink>buttons</button> can be used for similar purposes.
      </span>
    `,
  }),
};

export const Inactive: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <button type="button" bitLink disabled linkType="primary" class="tw-me-2">Primary</button>
      <button type="button" bitLink disabled linkType="secondary" class="tw-me-2">Secondary</button>
      <div class="tw-bg-bg-contrast tw-p-2 tw-inline-block">
        <button type="button" bitLink disabled linkType="contrast">Contrast</button>
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
