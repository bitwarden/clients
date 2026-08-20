import { StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { MasterPasswordPolicy } from "./master-password.component";

export default {
  ...policyDrawerMeta(new MasterPasswordPolicy()),
  title: "Admin Console/Organizations/Policies/Master Password",
};

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
