import { StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { PasswordGeneratorPolicy } from "./password-generator.component";

export default {
  ...policyDrawerMeta(
    "Admin Console/Organizations/Policies/Password Generator",
    new PasswordGeneratorPolicy(),
  ),
};

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
