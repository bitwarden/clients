import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import * as Icons from "../../icons";

type Args = {
  color?: string;
  disabled?: boolean;
  theme: Theme;
  size: number;
  iconLink: URL;
};

export default {
  title: "Components/Icons",
  argTypes: {
    iconLink: { control: "text" },
    color: { control: "color" },
    disabled: { control: "boolean" },
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    size: { control: "number", min: 10, max: 100, step: 1 },
  },
  args: {
    iconLink: new URL("https://bitwarden.com"),
    disabled: false,
    theme: ThemeTypes.Light,
    size: 50,
  },
} as Meta<Args>;

const Template = (args: Args, IconComponent: (props: Args) => ReturnType<typeof html>) => html`
  <div
    style="width: ${args.size}px; height: ${args.size}px; display: flex; align-items: center; justify-content: center;"
  >
    ${IconComponent({ ...args })}
  </div>
`;

const createIconStory = (iconName: keyof typeof Icons): StoryObj<Args> => {
  const story = {
    render: (args) => Template(args, Icons[iconName]),
  } as StoryObj<Args>;

  story.argTypes = {
    iconLink: { table: { disable: true } },
  };

  return story;
};

export const AngleDownIcon = createIconStory("AngleDown");
export const AngleUpIcon = createIconStory("AngleUp");
export const BusinessIcon = createIconStory("Business");
export const CloseIcon = createIconStory("Close");
export const CollectionSharedIcon = createIconStory("CollectionShared");
export const ExclamationTriangleIcon = createIconStory("ExclamationTriangle");
export const ExternalLinkIcon = createIconStory("ExternalLink");
export const FamilyIcon = createIconStory("Family");
export const FolderIcon = createIconStory("Folder");
export const GlobeIcon = createIconStory("Globe");
export const PencilSquareIcon = createIconStory("PencilSquare");
export const ShieldIcon = createIconStory("Shield");
export const UserIcon = createIconStory("User");
