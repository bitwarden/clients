import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import {
  InlineMenuPasswordGenerator,
  InlineMenuPasswordGeneratorProps,
} from "../../inline-menu/password-generator";
import { mockI18n } from "../mock-data";

const passwordGeneratorI18n = {
  generatedPassword: mockI18n.generatedPassword,
  lowercaseAriaLabel: mockI18n.lowercaseAriaLabel,
  uppercaseAriaLabel: mockI18n.uppercaseAriaLabel,
  regeneratePassword: mockI18n.regeneratePassword,
  characterDescriptors: {
    hashSignCharacterDescriptor: mockI18n.hashSignCharacterDescriptor,
    ampersandCharacterDescriptor: mockI18n.ampersandCharacterDescriptor,
    asteriskCharacterDescriptor: mockI18n.asteriskCharacterDescriptor,
    exclamationCharacterDescriptor: mockI18n.exclamationCharacterDescriptor,
  },
};

type ComponentAndControls = InlineMenuPasswordGeneratorProps & { width: number };

export default {
  title: "Components/Inline Menu/Password Generator",
  argTypes: {
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    password: { control: "text" },
    headingText: { control: "text" },
    handleFillPassword: { control: false },
    handleRefreshPassword: { control: false },
    width: { control: "number", min: 160, max: 480, step: 8 },
  },
  args: {
    password: "f9#WxF4HjsC&*6",
    headingText: mockI18n.fillGeneratedPassword,
    theme: ThemeTypes.Light,
    i18n: passwordGeneratorI18n,
    handleFillPassword: () => alert("Fill generated password"),
    handleRefreshPassword: () => alert("Regenerate password"),
    width: 280,
  },
} as Meta<ComponentAndControls>;

const Template = (args: ComponentAndControls) => {
  const { width, ...componentProps } = args;
  return html`
    <div style="width: ${width}px;">${InlineMenuPasswordGenerator({ ...componentProps })}</div>
  `;
};

export const FillGeneratedPassword: StoryObj<ComponentAndControls> = {
  args: {
    headingText: mockI18n.fillGeneratedPassword,
    password: "f9#WxF4HjsC&*6aB3!k",
    theme: ThemeTypes.Dark,
  },
  render: Template,
};

export const UseGeneratedPassword: StoryObj<ComponentAndControls> = {
  args: {
    headingText: "Use generated password",
    password: "f9#WxF4HjsC&*6aB3!k",
    theme: ThemeTypes.Dark,
  },
  render: Template,
};
