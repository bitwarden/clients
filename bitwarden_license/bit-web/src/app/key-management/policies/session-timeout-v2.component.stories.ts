import { StoryObj } from "@storybook/angular";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { enabledFlags } from "@bitwarden/storybook";
import {
  PolicyDrawerStoryArgs,
  policyDrawerMeta,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies/policy-drawer-story.helper";

import { SessionTimeoutPolicyV2 } from "./session-timeout-v2.component";

/**
 * Renders the PolicyDrawers-flag-on (drawer) experience for this policy. Session timeout uses two
 * entirely separate policy definitions (SessionTimeoutPolicyV2 here vs. SessionTimeoutPolicy in
 * session-timeout.component.ts), each gated to display only when the PolicyDrawers flag is on/off
 * respectively - pair this with session-timeout.component.stories.ts to catch a v2 leak into the
 * modal.
 */
export default {
  ...policyDrawerMeta(new SessionTimeoutPolicyV2()),
  title: "Admin Console/Organizations/Policies/Session Timeout",
};

type Story = StoryObj<PolicyDrawerStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};

/**
 * The drawer with the VFO1 terminology flag on — the prerequisite callout renders "single
 * organization membership policy" terminology per Figma.
 */
export const PolicyOnVfo1Enabled: Story = {
  args: { enabled: true },
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
};
