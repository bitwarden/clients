import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { formatArgsForCodeSnippet } from "@bitwarden/storybook";

import { I18nMockService } from "../utils/i18n-mock.service";

import { BitKbdComponent } from "./kbd.component";

export default {
  title: "Component Library/Kbd",
  component: BitKbdComponent,
  decorators: [
    moduleMetadata({
      imports: [BitKbdComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              keyEscape: "Esc",
              keyControl: "Ctrl",
              keyCommand: "Command",
            }),
        },
      ],
    }),
  ],
  args: {
    keys: ["modifier", "F"],
  },
} as Meta;

type Story = StoryObj<BitKbdComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-kbd ${formatArgsForCodeSnippet<BitKbdComponent>(args)} />
    `,
  }),
};

export const SingleKey: Story = {
  ...Default,
  args: {
    keys: ["Esc"],
  },
};
