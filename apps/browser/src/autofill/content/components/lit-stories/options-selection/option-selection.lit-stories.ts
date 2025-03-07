import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { Option } from "../../common-types";
import { themes } from "../../constants/styles";
import { User, Business } from "../../icons";
import "../../option-selection/option-selection";
import { mockOrganizationData } from "../mock-data";

const mockOptions: Option[] = [
  { icon: User, text: "My Vault", value: "0" },
  ...mockOrganizationData.map(({ id, name }) => ({ icon: Business, text: name, value: id })),
];

type ComponentProps = {
  disabled?: boolean;
  options: Option[];
  theme: Theme;
};

export default {
  title: "Components/Option Selection",
  argTypes: {
    theme: { control: "select", options: [ThemeTypes.Light, ThemeTypes.Dark] },
    options: { control: "object" },
    disabled: { control: "boolean" },
  },
  args: {
    options: mockOptions,
    theme: ThemeTypes.Light,
    disabled: false,
  },
} as Meta<ComponentProps>;

const BaseComponent = ({ disabled, theme, options }: ComponentProps) => {
  return html`
    <option-selection theme=${theme} .disabled=${disabled} .options=${options}></option-selection>
  `;
};

export const Light: StoryObj<ComponentProps> = {
  render: BaseComponent,
  argTypes: {
    theme: { control: "radio", options: [ThemeTypes.Light] },
  },
  args: {
    theme: ThemeTypes.Light,
  },
  parameters: {
    backgrounds: {
      values: [{ name: "Light", value: themes.light.background.alt }],
      default: "Light",
    },
  },
};

export const Dark: StoryObj<ComponentProps> = {
  render: BaseComponent,
  argTypes: {
    theme: { control: "radio", options: [ThemeTypes.Dark] },
  },
  args: {
    theme: ThemeTypes.Dark,
  },
  parameters: {
    backgrounds: {
      values: [{ name: "Dark", value: themes.dark.background.alt }],
      default: "Dark",
    },
  },
};
