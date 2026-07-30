import { Meta, StoryObj } from "@storybook/angular";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";

import { ProgressComponent } from "./progress.component";

export default {
  title: "Component Library/Progress",
  component: ProgressComponent,
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-40933&t=b5tDKylm5sWm2yKo-4",
    },
  },
  args: {
    showText: true,
    size: "default",
    bgColor: "primary",
  },
} as Meta;

type Story = StoryObj<ProgressComponent>;

export const Base: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-progress ${formatArgsForCodeSnippet<ProgressComponent>(args)}></bit-progress>
    `,
  }),
  args: {
    barWidth: 50,
  },
};

export const Empty: Story = {
  ...Base,
  args: {
    barWidth: 0,
  },
};

export const Full: Story = {
  ...Base,
  args: {
    barWidth: 100,
  },
};

export const CustomText: Story = {
  ...Base,
  args: {
    barWidth: 25,
    text: "Loading...",
  },
};
