import { Meta, StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { AutoConfirmPolicy } from "./auto-confirm-policy.component";

/**
 * Renders the PolicyDrawers-flag-on (drawer) experience for this policy. This policy uses
 * MultiStepPolicyEditDialogComponent for both the drawer and modal experiences, so pair this with
 * auto-confirm-policy-modal.component.stories.ts to catch a v2 leak into the modal.
 */
export default {
  ...policyDrawerMeta(new AutoConfirmPolicy()),
  title: "Admin Console/Organizations/Policies/Auto-confirm",
} satisfies Meta<PolicyDialogStoryArgs>;

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
