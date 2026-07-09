import { StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { MasterPasswordPolicy } from "./master-password.component";

/**
 * Renders the PolicyDrawers-flag-on (drawer) experience for this policy. This policy uses
 * MultiStepPolicyEditDialogComponent for both the drawer and modal experiences, so pair this with
 * master-password-modal.component.stories.ts to catch a v2 leak into the modal.
 */
export default {
  ...policyDrawerMeta(new MasterPasswordPolicy()),
  title: "Admin Console/Organizations/Policies/Master Password",
};

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
