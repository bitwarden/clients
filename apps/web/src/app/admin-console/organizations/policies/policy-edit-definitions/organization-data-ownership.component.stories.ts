import { StoryObj } from "@storybook/angular";

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
