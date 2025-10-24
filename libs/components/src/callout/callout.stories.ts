import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LinkModule, IconModule } from "@bitwarden/components";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";
import { I18nMockService } from "../utils/i18n-mock.service";

import { CalloutComponent } from "./callout.component";

export default {
  title: "Component Library/Callout",
  component: CalloutComponent,
  decorators: [
    moduleMetadata({
      imports: [LinkModule, IconModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              warning: "Warning",
              error: "Error",
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

export const Info: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-callout ${formatArgsForCodeSnippet<CalloutComponent>(args)}>The content of the callout</bit-callout>
    `,
  }),
  args: {
    title: "Callout title",
  },
};

export const Success: Story = {
  ...Info,
  args: {
    ...Info.args,
    type: "success",
  },
};

export const Warning: Story = {
  ...Info,
  args: {
    type: "warning",
  },
};

export const Danger: Story = {
  ...Info,
  args: {
    type: "danger",
  },
};

export const Default: Story = {
  ...Info,
  args: {
    ...Info.args,
    type: "default",
  },
};

export const CustomIcon: Story = {
  ...Info,
  args: {
    ...Info.args,
    icon: "bwi-star",
  },
};

export const NoTitle: Story = {
  ...Info,
  args: {
    icon: "",
  },
};

export const NoTitleWithIcon: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-callout ${formatArgsForCodeSnippet<CalloutComponent>(args)}>The content of the callout</bit-callout>
    `,
  }),
  args: {
    type: "default",
    icon: "bwi-globe",
  },
};

export const WithTextButton: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-callout ${formatArgsForCodeSnippet<CalloutComponent>(args)}>
      <p class="tw-mb-2">The content of the callout</p>
        <a bitLink> Visit the help center<i aria-hidden="true" class="bwi bwi-fw bwi-sm bwi-angle-right"></i> </a>
      </bit-callout>
    `,
  }),
  args: {
    type: "default",
    icon: "",
  },
};

export const WithWrappingContent: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-callout ${formatArgsForCodeSnippet<CalloutComponent>(args)}>
        This is a really long callout that should wrap when it reaches the end of the container. This is a really long callout that should wrap when it reaches the end of the container.
        This is a really long callout that should wrap when it reaches the end of the container. This is a really long callout that should wrap when it reaches the end of the container.
        This is a really long callout that should wrap when it reaches the end of the container. This is a really long callout that should wrap when it reaches the end of the container.
      </bit-callout>
    `,
  }),
  args: {
    type: "default",
    icon: "bwi-globe",
  },
};

export const Truncate: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 300px;">
        <bit-callout ${formatArgsForCodeSnippet<CalloutComponent>(args)}>
          This is a really long callout that should truncate when it reaches the end of the container. This is a really long title that should truncate. Like really, really, really, ridiculously long content.
        </bit-callout>
      </div>
    `,
  }),
  args: {
    title:
      "This is a really long title that should truncate. Like really, really, really, ridiculously long title",
    truncate: true,
  },
};

export const TruncateOnlyContent: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 300px;">
        <bit-callout ${formatArgsForCodeSnippet<CalloutComponent>(args)}>
          This is a really long callout that should truncate when it reaches the end of the container. This is a really long title that should truncate. Like really, really, really, ridiculously long content.
        </bit-callout>
      </div>
    `,
  }),
  args: {
    truncate: true,
  },
};
