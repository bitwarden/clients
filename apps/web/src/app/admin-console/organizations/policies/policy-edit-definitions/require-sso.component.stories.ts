import { StoryObj } from "@storybook/angular";

import { PolicyDrawerStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { RequireSsoPolicy } from "./require-sso.component";

export default {
  ...policyDrawerMeta("Admin Console/Organizations/Policies/Require SSO", new RequireSsoPolicy()),
};

type Story = StoryObj<PolicyDrawerStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
