import { StoryObj } from "@storybook/angular";

import { PolicyDrawerStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { SingleOrgPolicy } from "./single-org.component";

export default {
  ...policyDrawerMeta(new SingleOrgPolicy()),
  title: "Admin Console/Organizations/Policies/Single Organization",
};

type Story = StoryObj<PolicyDrawerStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
