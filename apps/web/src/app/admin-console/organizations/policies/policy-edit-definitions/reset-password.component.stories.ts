import { StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { ResetPasswordPolicy } from "./reset-password.component";

export default {
  ...policyDrawerMeta(
    "Admin Console/Organizations/Policies/Reset Password",
    new ResetPasswordPolicy(),
  ),
};

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
