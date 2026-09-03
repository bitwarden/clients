import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { formatArgsForCodeSnippet } from "@bitwarden/storybook";

import { BitKbdComponent } from "./kbd.component";

export default {
  title: "Component Library/Kbd",
  component: BitKbdComponent,
  decorators: [
    moduleMetadata({
      imports: [BitKbdComponent],
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
    keys: ["ESC"],
  },
};
