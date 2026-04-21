import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LinkModule, SvgModule, ButtonModule } from "@bitwarden/components";

import { I18nMockService } from "../utils/i18n-mock.service";

import { CalloutComponent } from "./callout.component";

export default {
  title: "Component Library/Callout",
  component: CalloutComponent,
  decorators: [
    moduleMetadata({
      imports: [LinkModule, SvgModule, ButtonModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              warning: "Warning",
              error: "Error",
              close: "Close",
              loading: "Loading",
              callout: "Callout",
            });
          },
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-28300&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta;

type Story = StoryObj<CalloutComponent>;
const calloutTitle = "Callout Title";
const calloutContent =
  "Great job! You've read some important information regarding your current action.";

export const Base: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-callout [type]="type" [icon]="icon" [title]="title">${calloutContent}</bit-callout>
    `,
  }),
  args: {
    title: calloutTitle,
    type: "info",
  },
};

export const AllVariants: Story = {
  render: () => ({
    template: /*html*/ `
      <div class="tw-flex tw-flex-col tw-gap-4">
        <bit-callout type="info" title="Info">${calloutContent}</bit-callout>
        <bit-callout type="success" title="Success">${calloutContent}</bit-callout>
        <bit-callout type="warning" title="Warning">${calloutContent}</bit-callout>
        <bit-callout type="danger" title="Danger">${calloutContent}</bit-callout>
        <bit-callout type="subtle" title="Subtle">${calloutContent}</bit-callout>
      </div>
    `,
  }),
};

export const CustomIcon: Story = {
  render: () => ({
    template: /*html*/ `
      <bit-callout title="${calloutTitle}" icon="bwi-star">${calloutContent}</bit-callout>
    `,
  }),
};

export const NoTitle: Story = {
  render: () => ({
    template: /*html*/ `
      <bit-callout [title]="null" accessibleName="Success callout">${calloutContent}</bit-callout>
    `,
  }),
};

export const WithAccessibleNameFallback: Story = {
  render: () => ({
    template: /*html*/ `
      <div class="tw-flex tw-flex-col tw-gap-4">
        <bit-callout type="info">${calloutContent}</bit-callout>
        <bit-callout type="success">${calloutContent}</bit-callout>
      </div>
    `,
  }),
};

export const NoIcon: Story = {
  render: () => ({
    template: /*html*/ `
      <bit-callout title="${calloutTitle}" [icon]="null">${calloutContent}</bit-callout>
    `,
  }),
};

export const WithInlineLink: Story = {
  render: () => ({
    template: /*html*/ `
      <bit-callout accessibleName="Success callout">
        ${calloutContent}
        <a bitLink endIcon="bwi-angle-right" class="tw-ml-2">Visit the help center</a>
      </bit-callout>
    `,
  }),
};

export const WithFooterButtons: Story = {
  render: () => ({
    template: /*html*/ `
      <div class="tw-flex tw-flex-col tw-gap-4">
        <bit-callout title="${calloutTitle}">
          ${calloutContent}
          <button slot="end" type="button" bitButton buttonType="primary">Button text</button>
          <button slot="end" type="button" bitButton buttonType="primaryOutline">Button text</button>
        </bit-callout>
        <bit-callout type="warning">
          ${calloutContent}
          <button slot="end" type="button" bitButton buttonType="warning">Button text</button>
          <button slot="end" type="button" bitButton buttonType="warningOutline">Button text</button>
        </bit-callout>
      </div>
    `,
  }),
};

export const WithCloseButton: Story = {
  render: () => ({
    template: /*html*/ `
    <div class="tw-flex tw-flex-col tw-gap-4">
      <bit-callout (dismiss)="onDismiss($event)" accessibleName="Success callout">
        ${calloutContent}
      </bit-callout>
      <bit-callout title="${calloutTitle}" (dismiss)="onDismiss($event)">
        ${calloutContent}
        <button slot="end" type="button" bitButton buttonType="primary">Button text</button>
        <button slot="end" type="button" bitButton buttonType="primaryOutline">Button text</button>
      </bit-callout>
    </div>
    `,
  }),
};
