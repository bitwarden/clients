import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";
import { I18nMockService } from "../utils/i18n-mock.service";

import { CalloutComponent } from "./callout.component";

export default {
  title: "Component Library/Callout",
  component: CalloutComponent,
  decorators: [
    moduleMetadata({
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
    icon: "bwi-star",
  },
};
