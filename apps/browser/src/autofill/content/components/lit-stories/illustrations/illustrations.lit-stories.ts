import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { IconProps } from "../../common-types";
import * as Illustrations from "../../illustrations";

type Args = IconProps & {
  size: number;
};

export default {
  title: "Components/Illustrations",
  argTypes: {
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    size: { control: "number", min: 10, max: 100, step: 1 },
  },
  args: {
    theme: ThemeTypes.Light,
    size: 50,
  },
} as Meta<Args>;

const Template = (
  args: Args,
  IllustrationComponent: (props: IconProps) => ReturnType<typeof html>,
) => html`
  <div
    style="width: ${args.size}px; height: ${args.size}px; display: flex; align-items: center; justify-content: center;"
  >
    ${IllustrationComponent({ ...args })}
  </div>
`;

const createIllustrationStory = (illustrationName: keyof typeof Illustrations): StoryObj<Args> => {
  return {
    render: (args) => Template(args, Illustrations[illustrationName]),
  } as StoryObj<Args>;
};

export const KeyholeIllustration = createIllustrationStory("Keyhole");
export const CelebrateIllustration = createIllustrationStory("Celebrate");
export const WarningIllustration = createIllustrationStory("Warning");
