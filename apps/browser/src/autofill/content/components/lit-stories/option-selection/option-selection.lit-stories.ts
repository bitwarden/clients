import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { themes } from "../../constants/styles";
import { Business, Family, User } from "../../icons";
import "../../option-selection/option-selection";

type Args = {
  buttonText: string;
  disabled: boolean;
  theme: Theme;
};

export default {
  title: "Components/Option Selection",
  argTypes: {
    theme: { control: "select", options: [ThemeTypes.Light, ThemeTypes.Dark] },
    disabled: { control: "boolean" },
  },
  args: {
    buttonText: "My vault",
    theme: ThemeTypes.Light,
    disabled: false,
  },
} as Meta<Args>;

const Template = ({ buttonText, theme, disabled }: Args) => {
  const iconProps = { color: themes[theme].text.main, theme };
  const activeIconProps = { ...iconProps, color: themes[theme].text.contrast };
  const mockVaultOptions = [
    { icon: User(iconProps), activeIcon: User(activeIconProps), text: "My Vault", value: 1 },
    {
      icon: Business(iconProps),
      activeIcon: Business(activeIconProps),
      text: "Acme, inc",
      value: 2,
    },
    {
      icon: Business(iconProps),
      activeIcon: Business(activeIconProps),
      text: "A Really Long Business Name That Just Kinda Goes On For A Really Long Time",
      value: 2,
    },
    {
      icon: Family(iconProps),
      activeIcon: Family(activeIconProps),
      text: "Family Vault",
      value: 3,
    },
  ];

  return html`
    <option-selection
      buttonText=${buttonText}
      theme=${theme}
      .disabled=${disabled}
      .icon=${User({ color: themes[theme].text.muted, theme: theme })}
      .options=${mockVaultOptions}
    ></option-selection>
  `;
};

export const Light: StoryObj<Args> = {
  render: Template,
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

export const Dark: StoryObj<Args> = {
  render: Template,
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
