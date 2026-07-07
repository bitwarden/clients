import { StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { SingleOrgPolicy } from "./single-org.component";

export default {
  ...policyDrawerMeta(
    "Admin Console/Organizations/Policies/Single Organization",
    new SingleOrgPolicy(),
  ),
};

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
