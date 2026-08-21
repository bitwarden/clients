import { StoryObj } from "@storybook/angular";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { enabledFlags } from "@bitwarden/storybook";

import { PolicyDrawerStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { RequireSsoPolicy } from "./require-sso.component";

export default {
  ...policyDrawerMeta(new RequireSsoPolicy()),
  title: "Admin Console/Organizations/Policies/Require SSO",
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
