import { StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { SingleOrgPolicy } from "./single-org.component";

export default {
  ...policyDrawerMeta(new SingleOrgPolicy()),
  title: "Admin Console/Organizations/Policies/Single Organization",
};

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
