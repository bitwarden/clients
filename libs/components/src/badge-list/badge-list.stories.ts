import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";
import { BadgeModule } from "../badge";
import { SharedModule } from "../shared";
import { I18nMockService } from "../utils/i18n-mock.service";

import { BadgeListComponent } from "./badge-list.component";

export default {
  title: "Component Library/Badge/List",
  component: BadgeListComponent,
  decorators: [
    moduleMetadata({
      imports: [SharedModule, BadgeModule, BadgeListComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              plusNMore: (n) => `+ ${n} more`,
            });
          },
        },
      ],
    }),
  ],
  args: {
    variant: "primary",
    truncate: false,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-26440&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta;

type Story = StoryObj<BadgeListComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-badge-list ${formatArgsForCodeSnippet<BadgeListComponent>(args)}></bit-badge-list>
    `,
  }),

  args: {
    variant: "info",
    maxItems: 3,
    items: ["Badge 1", "Badge 2", "Badge 3", "Badge 4", "Badge 5"],
    truncate: false,
  },
};

export const Truncated: Story = {
  ...Default,
  args: {
    variant: "info",
    maxItems: 3,
    items: ["Badge 1", "Badge 2 containing lengthy text", "Badge 3", "Badge 4", "Badge 5"],
    truncate: true,
  },
};
