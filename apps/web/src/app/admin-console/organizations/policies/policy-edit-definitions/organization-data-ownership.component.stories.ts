import { StoryObj } from "@storybook/angular";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { enabledFlags } from "@bitwarden/storybook";

import { PolicyDialogStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { OrganizationDataOwnershipPolicy } from "./organization-data-ownership.component";

/**
 * Renders the PolicyDrawers-flag-on (drawer) experience for this policy. This policy uses
 * MultiStepPolicyEditDialogComponent for both the drawer and modal experiences, so pair this with
 * organization-data-ownership-modal.component.stories.ts to catch a v2 leak into the modal.
 */
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
