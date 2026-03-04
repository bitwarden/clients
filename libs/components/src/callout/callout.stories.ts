import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LinkModule, SvgModule, ButtonModule } from "@bitwarden/components";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";
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
const calloutContent =
  "Great job! You've read some important information regarding your current action.";

export const Base: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-callout ${formatArgsForCodeSnippet<CalloutComponent>(args)}>${calloutContent}</bit-callout>
    `,
  }),
  args: {
    title: "Callout title",
  },
};

export const AllVariants: Story = {
  render: () => ({
    template: `
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
  ...Base,
  args: {
    ...Base.args,
    icon: "bwi-star",
  },
};

export const NoTitle: Story = {
  ...Base,
  args: {
    icon: "",
  },
};

export const NoTitleNoIcon: Story = {
  render: () => ({
    template: `
      <bit-callout [icon]="null">${calloutContent}</bit-callout>
    `,
  }),
};

export const WithInlineLink: Story = {
  render: () => ({
    template: `
      <bit-callout>
      <div class="tw-flex tw-gap-2 tw-items-center">
        ${calloutContent}
        <a bitLink endIcon="bwi-angle-right">Visit the help center</a>
        </div>
      </bit-callout>
    `,
  }),
};

export const WithFooterButtons: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-callout ${formatArgsForCodeSnippet<CalloutComponent>(args)}>
        ${calloutContent}
        <button slot="end" type="button" bitButton buttonType="primary">Button text</button>
        <button slot="end" type="button" bitButton>Button text</button>
      </bit-callout>
    `,
  }),
  args: {
    title: "Callout Title",
  },
};

export const WithCloseButton: Story = {
  render: (args) => ({
    props: args,
    template: `
    <div class="tw-flex tw-flex-col tw-gap-4">
      <bit-callout persistent="false">
        ${calloutContent}
      </bit-callout>
      <bit-callout ${formatArgsForCodeSnippet<CalloutComponent>(args)} persistent="false">
        ${calloutContent}
        <button slot="end" type="button" bitButton buttonType="primary">Button text</button>
        <button slot="end" type="button" bitButton>Button text</button>
      </bit-callout>
    </div>
    `,
  }),
  args: {
    title: "Callout Title",
  },
};
