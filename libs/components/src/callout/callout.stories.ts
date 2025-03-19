import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

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
  args: {
    type: "warning",
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-28300&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta;

type Story = StoryObj<CalloutComponent>;

export const Success: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-callout [type]="type" [title]="title">Content</bit-callout>
    `,
  }),
  args: {
    type: "success",
    title: "Success",
  },
};

export const Info: Story = {
  ...Success,
  args: {
    type: "info",
    title: "Info",
  },
};

export const Warning: Story = {
  ...Success,
  args: {
    type: "warning",
  },
};

export const Danger: Story = {
  ...Success,
  args: {
    type: "danger",
  },
};
