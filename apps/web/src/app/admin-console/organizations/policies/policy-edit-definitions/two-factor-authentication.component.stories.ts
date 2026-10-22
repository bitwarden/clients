import { StoryObj } from "@storybook/angular";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { enabledFlags } from "@bitwarden/storybook";

import { PolicyDrawerStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { TwoFactorAuthenticationPolicy } from "./two-factor-authentication.component";

export default {
  ...policyDrawerMeta(new TwoFactorAuthenticationPolicy()),
  title: "Admin Console/Organizations/Policies/Two Factor Authentication",
};

type Story = StoryObj<PolicyDrawerStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};

/**
 * The drawer with the VFO1 terminology flag on — the list description stays pinned to the short
 * "Require members to set up two-step login." text per Figma, rather than leaking the longer v2
 * drawer description.
 */
export const PolicyOnVfo1Enabled: Story = {
  args: { enabled: true },
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
};
