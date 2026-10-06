import { StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { PasswordGeneratorPolicy } from "./password-generator.component";

export default {
  ...policyDrawerMeta(new PasswordGeneratorPolicy()),
  title: "Admin Console/Organizations/Policies/Password Generator",
};

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
