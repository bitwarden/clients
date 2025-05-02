import { Meta, StoryObj } from "@storybook/web-components";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { ExampleComponent } from "../../../notification/types/example-component";

type Args = {
  message: string;
  theme: Theme;
};

export default {
  title: "Components/Refactor/Example",
  argTypes: {
    message: { control: "text" },
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
  },
  args: {
    message: "Hello Worlds.",
    theme: ThemeTypes.Light,
  },
} as Meta<Args>;

const Template = (args: Args) => ExampleComponent({ ...args });

export const Default: StoryObj<Args> = {
  render: Template,
};
