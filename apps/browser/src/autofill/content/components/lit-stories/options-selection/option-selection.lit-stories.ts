import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { Option } from "../../common-types";
import { themes } from "../../constants/styles";
import { Business, Family, User } from "../../icons";
import { FolderSelection } from "../../option-selection/folder-selection";
import { VaultSelection } from "../../option-selection/vault-selection";
import "../../option-selection/option-selection";

const mockOptions: Option[] = [
  { icon: User, text: "My Vault", value: 0 },
  {
    icon: Business,
    text: "Acme, inc",
    value: 1,
  },
  {
    icon: Business,
    default: true,
    text: "A Really Long Business Name That Just Kinda Goes On For A Really Long Time",
    value: 2,
  },
  {
    icon: Family,
    text: "Family Vault",
    value: 3,
  },
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

const FolderVariant = ({ theme, options }: ComponentProps) =>
  html`${FolderSelection({ theme, options })}`;

const VaultVariant = ({ theme, options }: ComponentProps) =>
  html`${VaultSelection({ theme, options })}`;

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

export const VaultLight: StoryObj<ComponentProps> = {
  ...Light,
  name: "Vault Selector (Light)",
  render: VaultVariant,
};

export const VaultDark: StoryObj<ComponentProps> = {
  ...Dark,
  name: "Vault Selector (Dark)",
  render: VaultVariant,
};

export const FolderLight: StoryObj<ComponentProps> = {
  ...Light,
  name: "Folder Selector (Light)",
  render: FolderVariant,
};

export const FolderDark: StoryObj<ComponentProps> = {
  ...Dark,
  name: "Folder Selector (Dark)",
  render: FolderVariant,
};
