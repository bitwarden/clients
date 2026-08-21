import { Meta, StoryObj } from "@storybook/angular";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { enabledFlags } from "@bitwarden/storybook";

import { PolicyDrawerStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { RestrictedItemTypesPolicy } from "./restricted-item-types.component";

export default {
  ...policyDrawerMeta(new RestrictedItemTypesPolicy()),
  title: "Admin Console/Organizations/Policies/Restricted Item Types",
} satisfies Meta<PolicyDrawerStoryArgs>;

type Story = StoryObj<PolicyDrawerStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};

/**
 * The drawer with the VFO1 terminology flag on — the description renders "vault" terminology
 * per Figma.
 */
export const PolicyOnVfo1Enabled: Story = {
  args: { enabled: true },
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
};
