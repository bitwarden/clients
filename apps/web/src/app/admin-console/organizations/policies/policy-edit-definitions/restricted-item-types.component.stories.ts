import { Meta, StoryObj } from "@storybook/angular";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { enabledFlags } from "@bitwarden/storybook";

import { PolicyDrawerStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { ManageItemTypesPolicy } from "./restricted-item-types.component";

export default {
  ...policyDrawerMeta(new ManageItemTypesPolicy()),
  title: "Admin Console/Organizations/Policies/Manage Item Types",
} satisfies Meta<PolicyDrawerStoryArgs>;

type Story = StoryObj<PolicyDrawerStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};

/**
 * With the new item types flag on, bank account, license and passport are also manageable.
 */
export const PolicyOnNewItemTypesEnabled: Story = {
  args: { enabled: true },
  globals: enabledFlags(FeatureFlag.PM32009NewItemTypes),
};
