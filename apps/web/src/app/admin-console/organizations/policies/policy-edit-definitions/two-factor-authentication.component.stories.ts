import { StoryObj } from "@storybook/angular";

import { PolicyDrawerStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { TwoFactorAuthenticationPolicy } from "./two-factor-authentication.component";

export default {
  ...policyDrawerMeta(
    "Admin Console/Organizations/Policies/Two Factor Authentication",
    new TwoFactorAuthenticationPolicy(),
  ),
};

type Story = StoryObj<PolicyDrawerStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
