import { StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { ResetPasswordPolicy } from "./reset-password.component";

export default {
  ...policyDrawerMeta(new ResetPasswordPolicy()),
  title: "Admin Console/Organizations/Policies/Reset Password",
};

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
