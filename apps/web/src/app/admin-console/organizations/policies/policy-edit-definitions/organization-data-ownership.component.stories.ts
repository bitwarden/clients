import { StoryObj } from "@storybook/angular";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { enabledFlags } from "@bitwarden/storybook";

import { PolicyDialogStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { OrganizationDataOwnershipPolicy } from "./organization-data-ownership.component";

export default {
  ...policyDrawerMeta(new OrganizationDataOwnershipPolicy()),
  title: "Admin Console/Organizations/Policies/Organization Data Ownership",
};

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};

/**
 * The drawer with the VFO1 terminology flag on — title, description, benefits, and the "Prompt
 * users to move their My vault items" checkbox render "vault" terminology per Figma.
 */
export const PolicyOnVfo1Enabled: Story = {
  args: { enabled: true },
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
};
