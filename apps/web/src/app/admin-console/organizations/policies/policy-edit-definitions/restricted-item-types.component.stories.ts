import { Meta, StoryObj } from "@storybook/angular";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { enabledFlags } from "@bitwarden/storybook";

import { PolicyDrawerStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { ManageItemTypesPolicy } from "./restricted-item-types.component";

export default {
  ...policyDrawerMeta(new ManageItemTypesPolicy()),
  args: { enabled: false, singleOrgEnabled: true },
  // Bank account, license and passport are also manageable with the new item types flag on.
  globals: enabledFlags(FeatureFlag.PM32009NewItemTypes),
  title: "Admin Console/Organizations/Policies/Manage Item Types",
} satisfies Meta<PolicyDrawerStoryArgs>;

type Story = StoryObj<PolicyDrawerStoryArgs>;

export const PolicyOff: Story = {};

/**
 * The single organization policy is off, so the callout renders and the toggle is disabled.
 */
export const PolicyOffSingleOrgDisabled: Story = {
  args: { singleOrgEnabled: false },
};

export const PolicyOn: Story = {
  args: { enabled: true },
};
