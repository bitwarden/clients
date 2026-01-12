import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { Option } from "../../common-types";
import { themes } from "../../constants/styles";
import { User, Business } from "../../icons";
import "../../option-selection/option-selection";
import { mockOrganizations } from "../mock-data";

const mockOptions: Option[] = [
  { icon: User, text: "My Vault", value: "0" },
  ...mockOrganizations.map(({ id, name }) => ({ icon: Business, text: name, value: id })),
];

type ComponentProps = {
  disabled?: boolean;
  id: string;
  label?: string;
  options: Option[];
  theme: Theme;
};

export default {
  title: "Components/Option Selection",
  argTypes: {
    disabled: { control: "boolean" },
    label: { control: "text" },
    options: { control: "object" },
    theme: { control: "select", options: [ThemeTypes.Light, ThemeTypes.Dark] },
  },
  args: {
    disabled: false,
    id: "example-id",
    label: undefined,
    options: mockOptions,
    theme: ThemeTypes.Light,
  },
} as Meta<ComponentProps>;

const BaseComponent = ({ disabled, id, label, options, theme }: ComponentProps) => {
  return html`
    <option-selection
      .disabled=${disabled}
      .id=${id}
      .label="${label}"
      .options=${options}
      theme=${theme}
    ></option-selection>
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
