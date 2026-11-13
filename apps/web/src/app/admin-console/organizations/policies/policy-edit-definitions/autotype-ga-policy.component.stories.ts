import { StoryObj } from "@storybook/angular";

import {
  AutotypeGaPolicyData,
  AutotypeShortcutOption,
  DEFAULT_AUTOTYPE_GA_KEYBOARD_SHORTCUT,
} from "@bitwarden/common/desktop-native/models/autotype-ga-policy.data";

import { PolicyDialogStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { DesktopAutotypeGaPolicy } from "./autotype-ga-policy.component";

export default {
  ...policyDrawerMeta(new DesktopAutotypeGaPolicy()),
  title: "Admin Console/Organizations/Policies/Desktop App Autofill",
};

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};

export const DefaultShortcut: Story = {
  args: {
    enabled: true,
    data: {
      shortcutOption: AutotypeShortcutOption.Default,
      defaultKeyboardShortcut: [...DEFAULT_AUTOTYPE_GA_KEYBOARD_SHORTCUT],
    } satisfies AutotypeGaPolicyData,
  },
};

export const CustomShortcut: Story = {
  args: {
    enabled: true,
    data: {
      shortcutOption: AutotypeShortcutOption.Custom,
      defaultKeyboardShortcut: ["Control", "Super", "K"],
    } satisfies AutotypeGaPolicyData,
  },
};
